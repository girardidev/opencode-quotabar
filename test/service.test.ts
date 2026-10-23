import { describe, expect, test } from "bun:test"
import { BACKOFF_BASE_MS, BACKOFF_CAP_MS, LEASE_MS } from "../src/service.ts"
import { conn, fail, harness, windows } from "./service-harness.ts"

describe("discovery and rows", () => {
  test("detected integrations that need a connection stay visible and explain themselves", async () => {
    const h = harness()
    h.state.connections.set("openai", undefined)
    const snapshot = await h.service.snapshot()
    const openai = h.row(snapshot, "openai")
    expect(openai.state).toBe("disconnected")
    expect(openai.diagnostic?.code).toBe("not_connected")
    expect(openai.windows).toEqual([])
    expect(h.pending("openai")).toHaveLength(0)
    expect(h.pending("claude-code")).toHaveLength(1)
  })

  test("the Claude row collects without a connection", async () => {
    const h = harness()
    h.state.connections.set("claude-code", undefined)
    const snapshot = await h.service.snapshot()
    expect(h.row(snapshot, "claude-code").state).toBe("loading")
    expect(h.pending("claude-code")).toHaveLength(1)
    h.pending("claude-code")[0]!.resolve()
    await h.settle()
    const claude = h.row(h.service.view(), "claude-code")
    expect(claude.state).toBe("ready")
    expect(claude.diagnostic).toBeUndefined()
  })

  test("a Claude row detected only through the anthropic provider collects", async () => {
    const h = harness()
    h.state.integrations = [{ id: "anthropic", name: "Anthropic" }]
    h.state.providers = [{ id: "anthropic", integrationID: "anthropic" }]
    h.state.connections.clear()
    await h.service.snapshot()
    expect(h.pending("claude-code")).toHaveLength(1)
    expect(h.pending("openai")).toHaveLength(0)
  })

  test("the Claude row resets when it moves between having a connection and not", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("claude-code")[0]!.resolve()
    await h.settle()
    expect(h.row(h.service.view(), "claude-code").windows).toHaveLength(1)

    h.state.connections.set("claude-code", undefined)
    await h.service.reconcile()
    await h.settle()
    const claude = h.row(h.service.view(), "claude-code")
    expect(claude.windows).toEqual([])
    expect(claude.state).toBe("loading")
    expect(h.pending("claude-code")).toHaveLength(1)
  })

  test("first snapshot shows loading rows without hiding anything", async () => {
    const h = harness()
    const snapshot = await h.service.snapshot()
    expect(snapshot.rows.map(r => [r.id, r.state])).toEqual([["openai", "loading"], ["claude-code", "loading"]])
    expect(snapshot.refreshing).toBe(true)
  })

  test("removed integrations disappear", async () => {
    const h = harness()
    await h.service.snapshot()
    h.state.integrations = []
    h.state.providers = []
    expect((await h.service.snapshot()).rows).toEqual([])
  })
})

describe("independent bounded refresh", () => {
  test("concurrent clients share one collection per account", async () => {
    const h = harness()
    const [a, b] = await Promise.all([h.service.snapshot(), h.service.snapshot()])
    await h.service.snapshot()
    expect(h.calls.filter(c => c.id === "openai")).toHaveLength(1)
    expect(h.calls.filter(c => c.id === "claude-code")).toHaveLength(1)
    h.pending("openai")[0]!.resolve()
    await h.settle()
    expect(h.row(h.service.view(), "openai").state).toBe("ready")
    expect(a.rows).toHaveLength(2)
    expect(b.rows).toHaveLength(2)
  })

  test("one collector failing does not hold back the other", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("openai")[0]!.resolve()
    await h.settle()
    const mid = h.service.view()
    expect(h.row(mid, "openai").state).toBe("ready")
    expect(h.row(mid, "claude-code").state).toBe("loading")
    h.pending("claude-code")[0]!.reject(fail("cli_missing"))
    await h.settle()
    const end = h.service.view()
    expect(h.row(end, "openai").state).toBe("ready")
    expect(h.row(end, "claude-code").state).toBe("unavailable")
    expect(h.row(end, "claude-code").diagnostic?.code).toBe("cli_missing")
  })

  test("snapshot reads never bypass a valid TTL", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending().forEach(c => c.resolve())
    await h.settle()
    h.clock.advance(60_000)
    await h.service.snapshot()
    await h.service.snapshot()
    expect(h.calls).toHaveLength(2)
    h.clock.advance(61_000)
    await h.service.snapshot()
    expect(h.calls).toHaveLength(4)
  })
})

describe("activity-aware scheduling", () => {
  test("no automatic work once the lease lapses; returns when a client does", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending().forEach(c => c.resolve())
    await h.settle()
    h.clock.advance(LEASE_MS + 1_000)
    await h.service.tick()
    expect(h.calls).toHaveLength(2)
    await h.service.snapshot()
    expect(h.calls).toHaveLength(4)
  })

  test("tick refreshes due accounts while the lease is valid", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending().forEach(c => c.resolve())
    await h.settle()
    h.clock.advance(125_000)
    h.service.touch()
    await h.service.tick()
    expect(h.calls).toHaveLength(4)
  })
})

describe("backoff and manual refresh", () => {
  test("manual refresh bypasses the TTL when there is no failure", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending().forEach(c => c.resolve())
    await h.settle()
    const refresh = h.service.manual("openai")
    await h.settle()
    expect(h.pending("openai")).toHaveLength(1)
    h.calls.at(-1)!.resolve()
    await refresh
    expect(h.calls.filter(c => c.id === "openai")).toHaveLength(2)
    expect(h.calls.filter(c => c.id === "claude-code")).toHaveLength(1)
  })

  test("manual refresh does not bypass failure backoff", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("openai")[0]!.reject(fail("network"))
    h.pending("claude-code")[0]!.resolve()
    await h.settle()
    const before = h.calls.length
    const snapshot = await h.service.manual("openai")
    expect(h.calls).toHaveLength(before)
    expect(h.row(snapshot, "openai").nextRetryAt).toBeGreaterThan(h.clock.now())
    h.clock.advance(BACKOFF_BASE_MS + 1)
    const retry = h.service.manual("openai")
    await h.settle()
    expect(h.calls).toHaveLength(before + 1)
    h.calls.at(-1)!.resolve()
    await retry
  })

  test("Retry-After is a lower bound for automatic and manual requests", async () => {
    const h = harness()
    await h.service.snapshot()
    const retryAt = h.clock.now() + 600_000
    h.pending("openai")[0]!.reject(fail("rate_limited", retryAt))
    await h.settle()
    const row = h.row(h.service.view(), "openai")
    expect(row.diagnostic?.code).toBe("rate_limited")
    expect(row.nextRetryAt).toBe(retryAt)
    expect(row.diagnostic?.retryAt).toBe(retryAt)
    h.clock.advance(599_000)
    const before = h.calls.length
    await h.service.manual("openai")
    h.service.touch()
    await h.service.tick()
    expect(h.calls).toHaveLength(before)
    h.clock.advance(2_000)
    h.service.touch()
    await h.service.tick()
    expect(h.calls).toHaveLength(before + 1)
  })

  test("exponential backoff with jitter stays under the cap", async () => {
    const h = harness()
    h.clock.randomValue = 1
    await h.service.snapshot()
    const delays: number[] = []
    for (let i = 0; i < 9; i++) {
      h.pending("openai").at(-1)!.reject(fail("network"))
      await h.settle()
      const next = h.row(h.service.view(), "openai").nextRetryAt!
      delays.push(next - h.clock.now())
      h.clock.advance(next - h.clock.now() + 1)
      h.service.touch()
      await h.service.tick()
    }
    expect(delays[0]).toBe(BACKOFF_BASE_MS)
    expect(delays[1]).toBe(BACKOFF_BASE_MS * 2)
    expect(delays[2]).toBe(BACKOFF_BASE_MS * 4)
    expect(Math.max(...delays)).toBeLessThanOrEqual(BACKOFF_CAP_MS)
    expect(delays.at(-1)).toBe(BACKOFF_CAP_MS)
  })

  test("jitter reduces the delay but never below 75%", async () => {
    const h = harness()
    h.clock.randomValue = 0
    await h.service.snapshot()
    h.pending("openai")[0]!.reject(fail("network"))
    await h.settle()
    expect(h.row(h.service.view(), "openai").nextRetryAt! - h.clock.now()).toBe(BACKOFF_BASE_MS * 0.75)
  })
})

describe("freshness independent of attempt status", () => {
  test("failure after success keeps stale windows with the original observation time", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("openai")[0]!.resolve({ windows: windows(61) })
    await h.settle()
    const observed = h.row(h.service.view(), "openai").observedAt!
    h.clock.advance(130_000)
    const refresh = h.service.manual("openai")
    await h.settle()
    h.calls.at(-1)!.reject(fail("timeout"))
    await refresh
    const row = h.row(h.service.view(), "openai")
    expect(row.windows[0]!.remaining).toBe(61)
    expect(row.freshness).toBe("stale")
    expect(row.state).toBe("error")
    expect(row.diagnostic?.code).toBe("timeout")
    expect(row.observedAt).toBe(observed)
    expect(row.attemptedAt).toBe(h.clock.now())
    expect(row.attemptedAt).toBeGreaterThan(row.observedAt!)
  })

  test("failure before any success exposes no fabricated percentage", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("openai")[0]!.reject(fail("forbidden"))
    await h.settle()
    const row = h.row(h.service.view(), "openai")
    expect(row.windows).toEqual([])
    expect(row.completeness).toBe("empty")
    expect(row.freshness).toBe("unknown")
    expect(row.observedAt).toBeUndefined()
    expect(row.diagnostic?.code).toBe("forbidden")
  })

  test("readings without a verified account are not retained across failures", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("claude-code")[0]!.resolve({ partition: undefined, identityUnverified: true })
    await h.settle()
    const row = h.row(h.service.view(), "claude-code")
    expect(row.diagnostic?.code).toBe("identity_unverified")
    expect(row.windows).toHaveLength(1)
    h.clock.advance(200_000)
    const refresh = h.service.manual("claude-code")
    await h.settle()
    h.calls.at(-1)!.reject(fail("cli_error"))
    await refresh
    expect(h.row(h.service.view(), "claude-code").windows).toEqual([])
  })

  test("account mismatch clears earlier readings", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("claude-code")[0]!.resolve()
    await h.settle()
    h.clock.advance(200_000)
    const refresh = h.service.manual("claude-code")
    await h.settle()
    h.calls.at(-1)!.reject(fail("account_mismatch"))
    await refresh
    const row = h.row(h.service.view(), "claude-code")
    expect(row.windows).toEqual([])
    expect(row.state).toBe("unavailable")
  })

  test("wrong authentication surfaces as incompatible_auth", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("openai")[0]!.reject(fail("wrong_auth"))
    await h.settle()
    expect(h.row(h.service.view(), "openai").state).toBe("incompatible_auth")
  })

  test("partial results are flagged and keep valid windows", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("openai")[0]!.resolve({ partial: true })
    await h.settle()
    const row = h.row(h.service.view(), "openai")
    expect(row.state).toBe("ready")
    expect(row.completeness).toBe("partial")
    expect(row.diagnostic?.code).toBe("partial_data")
  })
})

describe("reset requires confirmation", () => {
  test("a passed deadline triggers a refresh but never marks the window replenished", async () => {
    const h = harness()
    await h.service.snapshot()
    const resetsAt = h.clock.now() + 30_000
    h.pending("openai")[0]!.resolve({ windows: windows(10, resetsAt) })
    h.pending("claude-code")[0]!.resolve()
    await h.settle()
    h.clock.advance(31_000)
    h.service.touch()
    expect(h.row(h.service.view(), "openai").windows[0]!.remaining).toBe(10)
    await h.service.tick()
    expect(h.pending("openai")).toHaveLength(1)
    expect(h.row(h.service.view(), "openai").windows[0]!.remaining).toBe(10)
    // The provider still reports the old deadline: do not loop.
    h.pending("openai")[0]!.resolve({ windows: windows(10, resetsAt) })
    await h.settle()
    h.clock.advance(15_000)
    h.service.touch()
    await h.service.tick()
    expect(h.calls.filter(c => c.id === "openai")).toHaveLength(2)
  })
})

describe("account invalidation and cleanup", () => {
  test("a connection switch during a request discards the old result and old readings", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("openai")[0]!.resolve({ windows: windows(40) })
    await h.settle()
    h.clock.advance(200_000)
    const refresh = h.service.manual("openai")
    await h.settle()
    const old = h.calls.at(-1)!
    h.state.connections.set("openai", conn("cred_other"))
    await h.service.reconcile()
    expect(old.signal.aborted).toBe(true)
    expect(h.row(h.service.view(), "openai").windows).toEqual([])
    old.resolve({ windows: windows(5) })
    await refresh
    await h.settle()
    expect(h.row(h.service.view(), "openai").windows).toEqual([])
    expect(h.row(h.service.view(), "openai").observedAt).toBeUndefined()
    // New account collects fresh.
    const next = h.pending("openai").at(-1)!
    next.resolve({ windows: windows(90), partition: "other" })
    await h.settle()
    expect(h.row(h.service.view(), "openai").windows[0]!.remaining).toBe(90)
  })

  test("switching to an API key resets the row", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("openai")[0]!.resolve()
    await h.settle()
    h.state.connections.set("openai", conn("cred_openai", "key"))
    await h.service.reconcile()
    expect(h.row(h.service.view(), "openai").windows).toEqual([])
    expect(h.pending("openai")).toHaveLength(1)
  })

  test("disconnecting clears readings", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending("openai")[0]!.resolve()
    await h.settle()
    h.state.connections.set("openai", undefined)
    await h.service.reconcile()
    const row = h.row(h.service.view(), "openai")
    expect(row.state).toBe("disconnected")
    expect(row.windows).toEqual([])
  })

  test("unload aborts owned work, ignores late results and stops emitting", async () => {
    const h = harness()
    await h.service.snapshot()
    const [a, b] = h.pending()
    h.service.dispose()
    expect(a!.signal.aborted).toBe(true)
    expect(b!.signal.aborted).toBe(true)
    const emitted = h.events.length
    a!.resolve()
    b!.reject(fail("network"))
    await h.settle()
    expect(h.events).toHaveLength(emitted)
    await h.service.tick()
    expect(h.calls).toHaveLength(2)
  })

  test("snapshots stay in memory only and carry no raw identifiers", async () => {
    const h = harness()
    await h.service.snapshot()
    h.pending().forEach(c => c.resolve())
    await h.settle()
    const text = JSON.stringify(h.service.view())
    expect(text).not.toContain("cred_openai")
    expect(text).not.toContain("cred_marker")
  })

  test("locations are isolated", async () => {
    const a = harness()
    const b = harness()
    await a.service.snapshot()
    expect(a.calls).toHaveLength(2)
    expect(b.calls).toHaveLength(0)
    a.pending("openai")[0]!.resolve()
    await a.settle()
    expect((await b.service.snapshot()).rows.every(r => r.state === "loading")).toBe(true)
  })

  test("update events are emitted as rows change", async () => {
    const h = harness()
    await h.service.snapshot()
    const before = h.events.length
    h.pending("openai")[0]!.resolve()
    await h.settle()
    expect(h.events.length).toBeGreaterThan(before)
    expect(h.row(h.events.at(-1)!, "openai").state).toBe("ready")
  })
})
