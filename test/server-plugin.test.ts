import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import plugin from "../src/index.ts"
import { snapshotSchema, type QuotaSnapshot } from "../src/domain.ts"
import { QuotaRpc } from "../src/rpc.ts"
import { leaksAny } from "../src/redact.ts"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { alive, FAKE_CLAUDE, SECRETS } from "./helpers.ts"

const originalFetch = globalThis.fetch
const wham = { rate_limit: { primary_window: { used_percent: 16, limit_window_seconds: 18000, reset_at: 1_900_000_000 }, secondary_window: { used_percent: 3, limit_window_seconds: 604800, reset_at: 1_900_500_000 } } }

interface Fake {
  ctx: any
  handlers: any
  emitted: QuotaSnapshot[]
  push(event: { type: string }): void
  stopped(): boolean
  disposed(): boolean
  setConnection(integrationID: string, connection: unknown): void
  fetchCalls: Array<{ url: string; headers: Record<string, string> }>
}

/**
 * `anthropicOnly` mimics Anthropic served by a proxy plugin: the integration list enumerates
 * known integrations, the provider list holds `anthropic`, and no connection exists for it.
 */
function fakeHost(
  openaiValue: unknown = { type: "oauth", access: "oauth-ACCESS-secret", metadata: { accountId: "acct-PRIVATE-id" } },
  anthropicOnly = false,
): Fake {
  const connections = new Map<string, unknown>([["openai", { type: "credential", id: "cred_openai", label: "OAuth", method: "oauth" }]])
  if (!anthropicOnly) connections.set("claude-code", { type: "credential", id: "cred_marker", label: "OAuth", method: "oauth" })
  const queue: Array<{ type: string }> = []
  let wake: (() => void) | undefined
  let stopped = false
  let disposed = false
  const emitted: QuotaSnapshot[] = []
  const state: Partial<Fake> = {}
  const fake = {
    handlers: undefined as any,
    emitted,
    fetchCalls: [] as Fake["fetchCalls"],
    push(event: { type: string }) {
      queue.push(event)
      wake?.()
    },
    stopped: () => stopped,
    disposed: () => disposed,
    setConnection: (id: string, value: unknown) => void connections.set(id, value),
  }
  Object.assign(state, fake)
  const ctx = {
    options: { claudeExecutable: FAKE_CLAUDE, claudeTimeoutMs: 10_000 },
    integration: {
      list: async () => ({
        data: anthropicOnly
          ? [{ id: "openai", name: "OpenAI" }, { id: "anthropic", name: "Anthropic" }]
          : [{ id: "openai", name: "OpenAI" }, { id: "claude-code", name: "Claude Code" }, { id: "anthropic", name: "Anthropic" }],
      }),
      connection: {
        active: async (id: string) => connections.get(id),
        resolve: async () => openaiValue,
      },
    },
    provider: {
      list: async () => ({
        data: anthropicOnly
          ? [{ id: "openai", integrationID: "openai" }, { id: "anthropic", integrationID: "anthropic" }]
          : [{ id: "openai", integrationID: "openai" }, { id: "claude-code", integrationID: null }],
      }),
    },
    rpc: {
      register: async (definition: unknown, handlers: unknown) => {
        expect(definition).toBe(QuotaRpc)
        fake.handlers = handlers
        return {
          dispose: async () => void (disposed = true),
          events: { emit: async (_name: string, data: QuotaSnapshot) => void emitted.push(data) },
        }
      },
    },
    event: {
      subscribe: async function* ({ signal }: { signal: AbortSignal }) {
        signal.addEventListener("abort", () => {
          stopped = true
          wake?.()
        })
        while (!signal.aborted) {
          const next = queue.shift()
          if (next) yield next
          else await new Promise<void>(resolve => (wake = resolve))
        }
      },
    },
  }
  return Object.assign(fake, { ctx }) as unknown as Fake
}

async function until(check: () => boolean, ms = 8000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > ms) throw new Error("timed out waiting for condition")
    await Bun.sleep(10)
  }
}

let logs: ReturnType<typeof spyOn>[] = []
beforeEach(() => {
  process.env.FAKE_CLAUDE_SCENARIO = "ok"
  logs = (["log", "info", "warn", "error", "debug"] as const).map(name => spyOn(console, name).mockImplementation(() => {}))
})
afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.FAKE_CLAUDE_SCENARIO
  for (const spy of logs) spy.mockRestore()
})

function stubWham(fake: Fake, response: () => Response = () => new Response(JSON.stringify(wham))) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    fake.fetchCalls.push({ url: String(url), headers: init.headers as Record<string, string> })
    return response()
  }) as typeof fetch
}

describe("server plugin", () => {
  test("serves validated snapshots for Codex and Claude without leaking credentials", async () => {
    const fake = fakeHost()
    stubWham(fake)
    const cleanup = (await plugin.setup(fake.ctx)) as () => void
    const first = await fake.handlers.snapshot({}, {})
    expect(snapshotSchema.safeParse(first).success).toBe(true)
    expect(first.rows.map((r: any) => r.id)).toEqual(["openai", "claude-code"])

    await until(() => fake.emitted.some(s => s.rows.length === 2 && s.rows.every(r => r.state === "ready")))
    const ready = await fake.handlers.snapshot({}, {})
    expect(snapshotSchema.safeParse(ready).success).toBe(true)
    const codex = ready.rows.find((r: any) => r.id === "openai")
    const claude = ready.rows.find((r: any) => r.id === "claude-code")
    expect(codex.windows.map((w: any) => [w.label, w.remaining])).toEqual([["5h", 84], ["Weekly", 97]])
    expect(claude.windows.map((w: any) => [w.label, w.remaining])).toEqual([["Session", 100], ["Weekly", 78]])
    expect(claude.source).toBe("claude-cli")
    expect(claude.plan).toBe("pro")

    expect(fake.fetchCalls).toHaveLength(1)
    expect(fake.fetchCalls[0]!.url).toBe("https://chatgpt.com/backend-api/wham/usage")
    // Nothing sensitive in any payload ever handed to a client, nor in logs.
    expect(leaksAny([first, ready, ...fake.emitted], [...SECRETS, "cred_openai", "cred_marker"])).toBe(false)
    for (const spy of logs) expect(spy).not.toHaveBeenCalled()
    cleanup()
  })

  test("manual refresh validates input and returns a fresh snapshot", async () => {
    const fake = fakeHost()
    stubWham(fake)
    const cleanup = (await plugin.setup(fake.ctx)) as () => void
    await fake.handlers.snapshot({}, {})
    await until(() => fake.emitted.some(s => s.rows.every(r => r.state === "ready")))
    const refreshed = await fake.handlers.refresh({ integrationID: "openai" }, {})
    expect(snapshotSchema.safeParse(refreshed).success).toBe(true)
    expect(fake.fetchCalls).toHaveLength(2)
    expect(QuotaRpc.methods.refresh.input.safeParse({ integrationID: "anthropic" }).success).toBe(false)
    expect(QuotaRpc.methods.refresh.input.safeParse({}).success).toBe(true)
    cleanup()
  })

  test("Codex failures stay isolated from Claude and carry only allowlisted diagnostics", async () => {
    const fake = fakeHost()
    stubWham(fake, () => new Response("secret oauth-ACCESS-secret person@example.test", { status: 403 }))
    const cleanup = (await plugin.setup(fake.ctx)) as () => void
    await fake.handlers.snapshot({}, {})
    await until(() => fake.emitted.some(s => s.rows.find(r => r.id === "openai")?.state === "error" && s.rows.find(r => r.id === "claude-code")?.state === "ready"))
    const snapshot = await fake.handlers.snapshot({}, {})
    const codex = snapshot.rows.find((r: any) => r.id === "openai")
    expect(codex.diagnostic.code).toBe("forbidden")
    expect(codex.nextRetryAt).toBeGreaterThan(Date.now())
    expect(leaksAny([snapshot, ...fake.emitted], SECRETS)).toBe(false)
    cleanup()
  })

  test("an OpenAI API key is explained and never sent", async () => {
    const fake = fakeHost({ type: "key", key: "sk-ant-SECRET-key" })
    stubWham(fake)
    const cleanup = (await plugin.setup(fake.ctx)) as () => void
    await fake.handlers.snapshot({}, {})
    await until(() => fake.emitted.some(s => s.rows.find(r => r.id === "openai")?.state === "incompatible_auth"))
    expect(fake.fetchCalls).toHaveLength(0)
    expect(leaksAny(fake.emitted, SECRETS)).toBe(false)
    cleanup()
  })

  test("a missing Claude CLI keeps the row visible with a next action", async () => {
    const fake = fakeHost()
    fake.ctx.options = { claudeExecutable: "/nonexistent/claude" }
    stubWham(fake)
    const cleanup = (await plugin.setup(fake.ctx)) as () => void
    await fake.handlers.snapshot({}, {})
    await until(() => fake.emitted.some(s => s.rows.find(r => r.id === "claude-code")?.state === "unavailable"))
    const row = fake.emitted.at(-1)!.rows.find(r => r.id === "claude-code")!
    expect(row.diagnostic?.code).toBe("cli_missing")
    expect(row.diagnostic?.action).toContain("claudeExecutable")
    cleanup()
  })

  test("credential events reconcile connections", async () => {
    const fake = fakeHost()
    stubWham(fake)
    const cleanup = (await plugin.setup(fake.ctx)) as () => void
    await fake.handlers.snapshot({}, {})
    await until(() => fake.emitted.some(s => s.rows.every(r => r.state === "ready")))
    fake.setConnection("openai", undefined)
    fake.push({ type: "credential.switched" })
    await until(() => fake.emitted.at(-1)?.rows.find(r => r.id === "openai")?.state === "disconnected")
    cleanup()
  })

  test("Claude served through the anthropic provider reports limits without any connection", async () => {
    const fake = fakeHost(undefined, true)
    stubWham(fake)
    const cleanup = (await plugin.setup(fake.ctx)) as () => void
    const first = await fake.handlers.snapshot({}, {})
    expect(first.rows.map((r: any) => r.id)).toEqual(["openai", "claude-code"])
    await until(() => fake.emitted.some(s => s.rows.find(r => r.id === "claude-code")?.state === "ready"))
    const snapshot = await fake.handlers.snapshot({}, {})
    expect(snapshotSchema.safeParse(snapshot).success).toBe(true)
    const claude = snapshot.rows.find((r: any) => r.id === "claude-code")
    expect(claude.windows.map((w: any) => [w.label, w.remaining])).toEqual([["Session", 100], ["Weekly", 78]])
    expect(claude.source).toBe("claude-cli")
    expect(claude.partition).toMatch(/^[0-9a-f]{16}$/)
    expect(leaksAny([snapshot, ...fake.emitted], [...SECRETS, "cred_marker"])).toBe(false)
    cleanup()
  })

  test("a missing Claude CLI without a connection names the prerequisite, not a disconnected row", async () => {
    const fake = fakeHost(undefined, true)
    fake.ctx.options = { claudeExecutable: "/nonexistent/claude" }
    stubWham(fake)
    const cleanup = (await plugin.setup(fake.ctx)) as () => void
    await fake.handlers.snapshot({}, {})
    await until(() => fake.emitted.some(s => s.rows.find(r => r.id === "claude-code")?.state === "unavailable"))
    const row = fake.emitted.at(-1)!.rows.find(r => r.id === "claude-code")!
    expect(row.diagnostic?.code).toBe("cli_missing")
    expect(row.diagnostic?.action).toContain("claudeExecutable")
    cleanup()
  })

  test("unloading during a live CLI collection kills and reaps the child", async () => {
    const pidFile = `${tmpdir()}/quota-unload-${process.pid}-${Date.now()}.pid`
    process.env.FAKE_CLAUDE_SCENARIO = "hang"
    process.env.FAKE_CLAUDE_PID = pidFile
    try {
      const fake = fakeHost()
      stubWham(fake)
      const cleanup = (await plugin.setup(fake.ctx)) as () => void
      await fake.handlers.snapshot({}, {})
      await until(() => existsSync(pidFile))
      const pid = Number(readFileSync(pidFile, "utf8"))
      expect(alive(pid)).toBe(true)
      cleanup()
      await until(() => !alive(pid), 5000)
    } finally {
      delete process.env.FAKE_CLAUDE_PID
      rmSync(pidFile, { force: true })
    }
  })

  test("unload stops the event subscription and unregisters the RPC", async () => {
    const fake = fakeHost()
    stubWham(fake)
    const cleanup = (await plugin.setup(fake.ctx)) as () => void
    await fake.handlers.snapshot({}, {})
    cleanup()
    await until(() => fake.stopped() && fake.disposed())
    const count = fake.emitted.length
    await Bun.sleep(200)
    expect(fake.emitted.length).toBe(count)
  })
})
