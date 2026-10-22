import { describe, expect, test } from "bun:test"
import { DEFAULTS, parseOptions } from "../src/options.ts"

describe("parseOptions", () => {
  test("defaults", () => {
    const options = parseOptions(undefined)
    expect(options.ttlMs).toBe(120_000)
    expect(options.httpTimeoutMs).toBe(10_000)
    expect(options.claudeTimeoutMs).toBe(30_000)
    expect(options.claudeExecutable).toBe("claude")
  })

  test("clamps out-of-range numbers and ignores invalid values", () => {
    const options = parseOptions({ refreshTtlSeconds: 1, httpTimeoutMs: 999_999, claudeTimeoutMs: "fast", maxOutputBytes: Number.NaN })
    expect(options.ttlMs).toBe(30_000)
    expect(options.httpTimeoutMs).toBe(60_000)
    expect(options.claudeTimeoutMs).toBe(DEFAULTS.claudeTimeoutMs)
    expect(options.maxOutputBytes).toBe(DEFAULTS.maxOutputBytes)
    expect(parseOptions({ refreshTtlSeconds: 99_999 }).ttlMs).toBe(3_600_000)
    expect(parseOptions({ claudeTimeoutMs: 1 }).claudeTimeoutMs).toBe(5000)
  })

  test("executable must be a clean non-empty string", () => {
    expect(parseOptions({ claudeExecutable: "  /opt/bin/claude " }).claudeExecutable).toBe("/opt/bin/claude")
    expect(parseOptions({ claudeExecutable: "" }).claudeExecutable).toBe("claude")
    expect(parseOptions({ claudeExecutable: "a\nb" }).claudeExecutable).toBe("claude")
    expect(parseOptions({ claudeExecutable: 5 }).claudeExecutable).toBe("claude")
  })
})
