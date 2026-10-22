import { describe, expect, test } from "bun:test"
import { formatAge, formatDuration, formatPercent, formatRemaining, formatReset, formatShort, headline, statusText } from "../src/tui/format.ts"
import { HOUR, NOW, codex, row, win } from "./tui-helpers.ts"

describe("format", () => {
  test("percent never rounds used quota up to 100 or remaining quota down to 0", () => {
    expect(formatPercent(78)).toBe("78%")
    expect(formatPercent(0)).toBe("0%")
    expect(formatPercent(100)).toBe("100%")
    expect(formatPercent(0.3)).toBe("<1%")
    expect(formatPercent(99.7)).toBe("99%")
    expect(formatPercent(77.5)).toBe("78%")
  })

  test("zero is shown as 0% left, unknown as unknown", () => {
    expect(formatRemaining(win({ remaining: 0 }))).toBe("0% left")
    expect(formatRemaining(win({ remaining: undefined }))).toBe("unknown")
  })

  test("durations", () => {
    expect(formatDuration(30_000)).toBe("<1m")
    expect(formatDuration(5 * 60_000)).toBe("5m")
    expect(formatDuration(2 * HOUR + 10 * 60_000)).toBe("2h 10m")
    expect(formatDuration(30 * HOUR)).toBe("1d 6h")
    expect(formatShort(2 * HOUR + 10 * 60_000)).toBe("2h")
  })

  test("a passed reset reads pending, never full", () => {
    expect(formatReset(NOW + 2 * HOUR, NOW)).toBe("resets in 2h 0m")
    expect(formatReset(NOW - 1, NOW)).toBe("reset pending refresh")
    expect(formatReset(undefined, NOW)).toBe("reset time unknown")
  })

  test("age", () => {
    expect(formatAge(undefined, NOW)).toBe("no successful reading yet")
    expect(formatAge(NOW - 10_000, NOW)).toBe("updated just now")
    expect(formatAge(NOW - 8 * 60_000, NOW)).toBe("updated 8m ago")
  })

  test("headline prefers the server's active meter, else the lowest known window", () => {
    const active = row()
    expect(headline(active)?.label).toBe("Weekly")
    const lowest = row({ windows: [win({ id: "a", label: "A", remaining: 40 }), win({ id: "b", label: "B", remaining: 10 }), win({ id: "c", label: "C", remaining: undefined })] })
    expect(headline(lowest)?.label).toBe("B")
    expect(headline(row({ windows: [] }))).toBeUndefined()
    expect(headline(row({ windows: [win({ remaining: undefined, label: "Only" })] }))?.label).toBe("Only")
    // An active meter without a percentage must not hide a known one.
    expect(headline(row({ windows: [win({ id: "a", label: "A", remaining: undefined, active: true }), win({ id: "b", label: "B", remaining: 30 })] }))?.label).toBe("B")
  })

  test("status text is words, and offline wins over provider state", () => {
    expect(statusText(codex())).toBe("")
    expect(statusText(codex({ freshness: "stale" }))).toBe("stale")
    expect(statusText(codex({ completeness: "partial" }))).toBe("partial")
    expect(statusText(codex({ state: "disconnected" }))).toBe("not connected")
    expect(statusText(codex({ state: "incompatible_auth" }))).toBe("needs OAuth sign-in")
    expect(statusText(codex({ state: "error", diagnostic: { code: "forbidden", message: "m", action: "a" } }))).toBe("access denied")
    expect(statusText(codex({ state: "error", diagnostic: { code: "unauthorized", message: "m", action: "a" } }))).toBe("sign-in rejected")
    expect(statusText(codex(), true)).toBe("offline · showing last data")
  })
})
