import { describe, expect, test } from "bun:test"
import { CLAUDE_ARGS, buildChildEnv, runClaudeUsage } from "../src/collectors/claude/transport.ts"
import { CollectError } from "../src/diagnostics.ts"
import { alive, fakeRun } from "./helpers.ts"

async function code(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error instanceof CollectError ? error.code : `other:${(error as Error).name}`
  }
  return "no-error"
}

describe("claude transport", () => {
  test("supported CLI returns usage without a user message", async () => {
    const run = fakeRun("ok")
    const result = await runClaudeUsage(run.options)
    expect(result.account.apiProvider).toBe("firstParty")
    expect(result.accountAfter?.email).toBe(result.account.email)
    expect(result.cliVersion).toBe("9.9.9-fake")
    expect((result.usage as any).subscription_type).toBe("pro")

    const received = run.records().filter(r => r.kind === "recv").map(r => r.message)
    expect(received.map(m => m.request.subtype)).toEqual(["initialize", "get_usage", "initialize"])
    expect(received.every(m => m.type === "control_request")).toBe(true)
    expect(received.find(m => m.request.subtype === "get_usage").request.skip_behaviors).toBe(true)
    expect(received.some(m => m.type === "user")).toBe(false)
  })

  test("launches without a shell using isolation flags, a neutral cwd and stripped credentials", async () => {
    const run = fakeRun("ok", {}, { ANTHROPIC_API_KEY: "sk-ant-SECRET-key", CLAUDE_CODE_OAUTH_TOKEN: "t", ANTHROPIC_BASE_URL: "http://x" })
    await runClaudeUsage(run.options)
    const start = run.records().find(r => r.kind === "start")!
    expect(start.argv).toEqual([...CLAUDE_ARGS])
    for (const flag of ["--no-session-persistence", "--safe-mode", "--strict-mcp-config"]) expect(start.argv).toContain(flag)
    expect(start.argv).not.toContain("--bare")
    expect(start.cwd).toContain("quota-claude-")
    expect(start.env.ANTHROPIC_API_KEY).toBeNull()
    expect(start.env.CLAUDE_CODE_OAUTH_TOKEN).toBeNull()
    expect(start.env.ANTHROPIC_BASE_URL).toBeNull()
    expect(start.env.PATH).toBeTruthy()
    expect(start.env.HOME).toBeTruthy()
  })

  test("buildChildEnv keeps platform variables and drops overrides", () => {
    const env = buildChildEnv({ PATH: "/bin", HOME: "/h", ANTHROPIC_API_KEY: "k", NODE_OPTIONS: "--x" })
    expect(env).toEqual({ PATH: "/bin", HOME: "/h" })
  })

  test("handles fragmented responses", async () => {
    const result = await runClaudeUsage(fakeRun("fragmented").options)
    expect((result.usage as any).rate_limits_available).toBe(true)
  })

  test("unrelated and uncorrelated events never become quota data", async () => {
    const result = await runClaudeUsage(fakeRun("unrelated").options)
    const limits = (result.usage as any).rate_limits.limits
    expect(limits.map((l: any) => l.kind)).toEqual(["session", "weekly_all"])
  })

  test("malformed output is a sanitized error and the child is reaped", async () => {
    const run = fakeRun("malformed")
    expect(await code(runClaudeUsage(run.options))).toBe("invalid_response")
    await Bun.sleep(50)
    expect(alive(run.pid())).toBe(false)
  })

  test("oversized output is capped and the child is reaped", async () => {
    const run = fakeRun("oversized", { maxOutputBytes: 16_384 })
    expect(await code(runClaudeUsage(run.options))).toBe("invalid_response")
    await Bun.sleep(50)
    expect(alive(run.pid())).toBe(false)
  })

  test("timeout terminates and reaps a hung child", async () => {
    const run = fakeRun("hang", { timeoutMs: 400 })
    expect(await code(runClaudeUsage(run.options))).toBe("timeout")
    expect(alive(run.pid())).toBe(false)
  })

  test("escalates to SIGKILL when the child ignores SIGTERM", async () => {
    const run = fakeRun("stubborn", { timeoutMs: 300, graceMs: 150 })
    expect(await code(runClaudeUsage(run.options))).toBe("timeout")
    expect(alive(run.pid())).toBe(false)
  })

  test("cancellation kills the child and surfaces an abort", async () => {
    const controller = new AbortController()
    const run = fakeRun("hang", { signal: controller.signal })
    const promise = runClaudeUsage(run.options)
    setTimeout(() => controller.abort(), 150)
    expect(await code(promise)).toBe("other:AbortError")
    expect(alive(run.pid())).toBe(false)
  })

  test("already-aborted signals never spawn", async () => {
    const controller = new AbortController()
    controller.abort()
    const run = fakeRun("ok", { signal: controller.signal })
    expect(await code(runClaudeUsage(run.options))).toBe("other:AbortError")
    expect(run.records()).toEqual([])
  })

  test("unsupported control operation is a compatibility error without prompt fallback", async () => {
    const run = fakeRun("unsupported-op")
    expect(await code(runClaudeUsage(run.options))).toBe("unsupported_protocol")
    const received = run.records().filter(r => r.kind === "recv").map(r => r.message)
    expect(received.some(m => m.type === "user")).toBe(false)
    expect(received.map(m => m.request.subtype)).toEqual(["initialize", "get_usage"])
  })

  test("rejected flags are a compatibility error", async () => {
    expect(await code(runClaudeUsage(fakeRun("flag-error").options))).toBe("unsupported_protocol")
  })

  test("signed-out exits are classified without forwarding stderr", async () => {
    expect(await code(runClaudeUsage(fakeRun("signed-out-exit").options))).toBe("cli_signed_out")
  })

  test("sensitive child stderr never reaches the error", async () => {
    let caught: unknown
    try {
      await runClaudeUsage(fakeRun("stderr-secret").options)
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(CollectError)
    expect((caught as CollectError).code).toBe("cli_error")
    const text = `${(caught as Error).message}\n${(caught as Error).stack}\n${JSON.stringify(caught)}`
    expect(text).not.toContain("sk-ant-SECRET-key")
    expect(text).not.toContain("person@example.test")
  })

  test("missing executable", async () => {
    const run = fakeRun("ok", { executable: "/nonexistent/claude-binary" })
    expect(await code(runClaudeUsage(run.options))).toBe("cli_missing")
  })

  test("repeated initialize reports the identity seen after usage", async () => {
    const result = await runClaudeUsage(fakeRun("identity-race").options)
    expect(result.account.email).not.toBe(result.accountAfter?.email)
  })
})
