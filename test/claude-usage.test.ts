import { describe, expect, test } from "bun:test"
import usageFixture from "./fixtures/claude-usage.json"
import { createClaudeCollector } from "../src/collectors/claude/collector.ts"
import { parseClaudeUsage } from "../src/collectors/claude/usage.ts"
import type { RawClaudeUsage } from "../src/collectors/claude/transport.ts"
import { CollectError } from "../src/diagnostics.ts"
import { leaksAny } from "../src/redact.ts"
import { SECRETS } from "./helpers.ts"

const clone = <T>(value: T): T => structuredClone(value)

function thrown(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    return error instanceof CollectError ? error.code : "other"
  }
  return "none"
}

describe("parseClaudeUsage", () => {
  test("prefers server rows and preserves kind/group/severity/order/active", () => {
    const parsed = parseClaudeUsage(usageFixture)
    expect(parsed.windows.map(w => [w.label, w.remaining, w.group, w.severity, w.active])).toEqual([
      ["Session", 100, "session", "normal", false],
      ["Weekly", 78, "weekly", "normal", true],
    ])
    expect(parsed.windows[0]!.resetsAt).toBe(Date.parse("2026-10-22T23:00:00.045052+00:00"))
    expect(parsed.plan).toBe("pro")
    expect(parsed.partial).toBe(false)
  })

  test("zero used is a valid 100% remaining, not unknown", () => {
    expect(parseClaudeUsage(usageFixture).windows[0]!.remaining).toBe(100)
  })

  test("explicitly empty rows mean no meters, not reconstruction from legacy fields", () => {
    const data = clone(usageFixture) as any
    data.rate_limits.limits = []
    const parsed = parseClaudeUsage(data)
    expect(parsed.windows).toEqual([])
    expect(parsed.partial).toBe(false)
  })

  test("legacy windows use 0-100 percentages when rows are absent or null", () => {
    for (const rows of [undefined, null]) {
      const data = clone(usageFixture) as any
      if (rows === undefined) delete data.rate_limits.limits
      else data.rate_limits.limits = null
      const parsed = parseClaudeUsage(data)
      expect(parsed.windows.map(w => [w.label, w.remaining])).toEqual([
        ["Session", 100],
        ["Weekly", 78],
      ])
    }
  })

  test("null optional model windows are omitted and disabled extra usage is metadata", () => {
    const data = clone(usageFixture) as any
    delete data.rate_limits.limits
    const parsed = parseClaudeUsage(data)
    expect(parsed.windows.some(w => w.id.includes("opus") || w.id.includes("sonnet"))).toBe(false)
    expect(parsed.extraUsageEnabled).toBe(false)
  })

  test("invalid percentages are dropped as partial, never healthy", () => {
    const data = clone(usageFixture) as any
    data.rate_limits.limits.push(
      { kind: "weekly_scoped", group: "weekly", percent: 140, resets_at: null, severity: "normal", is_active: false, scope: { model: { display_name: "Fable" } } },
      { kind: "weekly_scoped", group: "weekly", percent: "lots", resets_at: null, severity: "normal", is_active: false },
      { kind: "weekly_scoped", group: "weekly", percent: Number.NaN, resets_at: null, severity: "normal", is_active: false },
    )
    const parsed = parseClaudeUsage(data)
    expect(parsed.partial).toBe(true)
    expect(parsed.windows).toHaveLength(2)
    expect(parsed.windows.every(w => w.remaining !== undefined && w.remaining <= 100)).toBe(true)
  })

  test("missing percentage and reset stay unknown", () => {
    const data = clone(usageFixture) as any
    data.rate_limits.limits = [{ kind: "session", group: "session", percent: null, resets_at: null, severity: "normal", is_active: false }]
    const [window] = parseClaudeUsage(data).windows
    expect(window).toBeDefined()
    expect(window!.remaining).toBeUndefined()
    expect(window!.resetsAt).toBeUndefined()
  })

  test("structurally valid new meter kinds are preserved with safe labels", () => {
    const data = clone(usageFixture) as any
    data.rate_limits.limits.push({
      kind: "daily_burst",
      group: "daily",
      percent: 10,
      resets_at: "2026-10-23T00:00:00Z",
      severity: "warning",
      is_active: false,
      scope: { surface: { display_name: "Cowork\u0007" } },
    })
    const added = parseClaudeUsage(data).windows.at(-1)!
    expect(added.label).toBe("Daily burst · Cowork")
    expect(added.severity).toBe("warning")
  })

  test("all rows invalid is a response-schema error", () => {
    const data = clone(usageFixture) as any
    data.rate_limits.limits = [{ kind: "session", percent: 500 }]
    expect(thrown(() => parseClaudeUsage(data))).toBe("invalid_response")
  })

  test("non-subscription sessions and unusable shapes", () => {
    expect(thrown(() => parseClaudeUsage({ rate_limits_available: false, rate_limits: null }))).toBe("cli_signed_out")
    expect(thrown(() => parseClaudeUsage({ rate_limits_available: true, rate_limits: null }))).toBe("upstream_error")
    expect(thrown(() => parseClaudeUsage("nope"))).toBe("invalid_response")
    expect(thrown(() => parseClaudeUsage({ rate_limits: 5 }))).toBe("invalid_response")
  })
})

describe("claude collector", () => {
  const account = { email: "person@example.test", organization: "Org", subscriptionType: "pro", apiProvider: "firstParty" }
  const raw = (overrides: Partial<RawClaudeUsage> = {}): RawClaudeUsage => ({ account, accountAfter: account, cliVersion: "2.1.306", usage: usageFixture, ...overrides })
  const collector = (result: RawClaudeUsage) =>
    createClaudeCollector({ connectionKey: "credential:cred_marker", executable: "claude", timeoutMs: 1000, maxOutputBytes: 1000, run: async () => result })

  test("collects windows, plan, version and an opaque partition", async () => {
    const result = await collector(raw()).collect(new AbortController().signal)
    expect(result.windows).toHaveLength(2)
    expect(result.plan).toBe("pro")
    expect(result.cliVersion).toBe("2.1.306")
    expect(result.partition).toMatch(/^[0-9a-f]{16}$/)
    expect(leaksAny(result, SECRETS)).toBe(false)
  })

  test("account changed during the request is discarded", async () => {
    const run = collector(raw({ accountAfter: { ...account, email: "other@example.test" } }))
    await expect(run.collect(new AbortController().signal)).rejects.toMatchObject({ code: "account_mismatch" })
  })

  test("missing identity is flagged and gets no partition", async () => {
    const result = await collector(raw({ account: { apiProvider: "firstParty", subscriptionType: "pro" }, accountAfter: undefined })).collect(new AbortController().signal)
    expect(result.identityUnverified).toBe(true)
    expect(result.partition).toBeUndefined()
  })

  test("third-party providers are not subscriptions", async () => {
    const run = collector(raw({ account: { apiProvider: "bedrock" }, accountAfter: undefined }))
    await expect(run.collect(new AbortController().signal)).rejects.toMatchObject({ code: "cli_signed_out" })
  })

  test("the stored marker is never part of the result", async () => {
    const result = await collector(raw()).collect(new AbortController().signal)
    expect(JSON.stringify(result)).not.toContain("cred_marker")
  })

  describe("without a connection", () => {
    const bare = (result: RawClaudeUsage) => createClaudeCollector({ executable: "claude", timeoutMs: 1000, maxOutputBytes: 1000, run: async () => result })

    test("binds the partition to the verified CLI identity alone", async () => {
      const result = await bare(raw()).collect(new AbortController().signal)
      expect(result.partition).toMatch(/^[0-9a-f]{16}$/)
      const other = await bare(raw({ account: { ...account, email: "other@example.test" }, accountAfter: undefined })).collect(new AbortController().signal)
      expect(other.partition).toMatch(/^[0-9a-f]{16}$/)
      expect(other.partition).not.toBe(result.partition)
      expect(result.partition).not.toBe((await collector(raw()).collect(new AbortController().signal)).partition)
    })

    test("an account that changes during the request is still discarded", async () => {
      const run = bare(raw({ accountAfter: { ...account, organization: "Other Org" } }))
      await expect(run.collect(new AbortController().signal)).rejects.toMatchObject({ code: "account_mismatch" })
    })

    test("missing identity is flagged and gets no partition", async () => {
      const result = await bare(raw({ account: { apiProvider: "firstParty", subscriptionType: "pro" }, accountAfter: undefined })).collect(new AbortController().signal)
      expect(result.identityUnverified).toBe(true)
      expect(result.partition).toBeUndefined()
    })
  })
})
