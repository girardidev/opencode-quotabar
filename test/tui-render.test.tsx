/** @jsxImportSource @opentui/solid */
import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { createSignal } from "solid-js"
import type { JSX } from "@opentui/solid"
import type { QuotaSnapshot } from "../src/domain.ts"
import type { Prefs, ServiceStatus } from "../src/tui/model.ts"
import { DetailsView, SidebarView } from "../src/tui/views.tsx"
import { HOUR, NOW, codex, palette, prefs as makePrefs, row, snapshot, win } from "./tui-helpers.ts"

const noop = () => {}

const open: Array<{ dispose(): Promise<void> }> = []
afterEach(async () => {
  for (const setup of open.splice(0)) await setup.dispose().catch(() => {})
})

async function frame(node: () => JSX.Element, width = 40, height = 50) {
  const setup = await testRender(node, { width, height })
  open.push(setup)
  await setup.renderOnce()
  const lines = setup.captureCharFrame().split("\n").map(line => line.trimEnd())
  return { setup, text: lines.join("\n"), lines }
}

interface SidebarOpts {
  snap?: QuotaSnapshot
  status?: ServiceStatus
  prefs?: Prefs
  current?: string
  width?: number
  open?: () => void
  toggleRow?: (id: string) => void
  toggleCollapsed?: () => void
}

const sidebar = (o: SidebarOpts = {}) => () => (
  <box width={o.width ?? 40}>
    <SidebarView
      snapshot={o.snap ?? snapshot(codex(), row())}
      status={o.status ?? "ok"}
      prefs={o.prefs ?? makePrefs()}
      currentProviderID={o.current}
      now={NOW}
      palette={palette}
      width={o.width ?? 40}
      onToggleCollapsed={o.toggleCollapsed ?? noop}
      onToggleRow={o.toggleRow ?? noop}
      onOpenDetails={o.open ?? noop}
    />
  </box>
)

interface DetailsOpts {
  snap?: QuotaSnapshot
  status?: ServiceStatus
  prefs?: Prefs
  selected?: string
  current?: string
  width?: number
  onRefresh?: (id?: string) => void
  onToggleHidden?: (id: string) => void
  onToggleDisplayMode?: () => void
}

const details = (o: DetailsOpts = {}) => () => (
  <DetailsView
    snapshot={o.snap ?? snapshot(codex(), row())}
    status={o.status ?? "ok"}
    prefs={o.prefs ?? makePrefs()}
    selectedId={o.selected}
    currentProviderID={o.current}
    now={NOW}
    palette={palette}
    width={o.width ?? 76}
    onSelect={noop}
    onRefresh={o.onRefresh ?? noop}
    onToggleHidden={o.onToggleHidden ?? noop}
    onToggleDisplayMode={o.onToggleDisplayMode ?? noop}
    onClose={noop}
  />
)

/** Counts filled/empty meter cells on the line following a given label line. */
const meterAfter = (lines: string[], label: string) => {
  const index = lines.findIndex(line => line.includes(label))
  const bar = lines[index + 1] ?? ""
  return { filled: (bar.match(/━/g) ?? []).length, empty: (bar.match(/─/g) ?? []).length }
}

describe("sidebar", () => {
  test("each fitting window uses one label/reset/value line followed by its meter", async () => {
    const snap = snapshot(codex({ windows: [win({ label: "5h", remaining: 80, resetsAt: NOW + HOUR + 8 * 60_000 }), win({ label: "Weekly", remaining: 95, resetsAt: NOW + 148 * HOUR })] }))
    const { lines } = await frame(sidebar({ snap, width: 38 }), 38)
    const first = lines.findIndex(line => line.includes("5h · 1h 8m"))
    expect(lines[first]).toMatch(/5h · 1h 8m\s+80%$/)
    expect(lines[first + 1]).toMatch(/━/)
    expect(lines[first + 2]).toMatch(/Weekly · 6d 4h\s+95%$/)
    expect(lines[first + 3]).toMatch(/━/)
  })

  test("used mode inverts text and meter fill together, including endpoints", async () => {
    for (const [remaining, used] of [[80, 20], [0, 100], [100, 0]]) {
      const snap = snapshot(codex({ windows: [win({ label: "5h", remaining })] }))
      const { text, lines } = await frame(sidebar({ snap, prefs: makePrefs({ displayMode: "used" }) }))
      expect(text).toContain(`${used}%`)
      const bar = meterAfter(lines, "5h")
      expect(Math.abs(bar.filled / (bar.filled + bar.empty) - used! / 100)).toBeLessThan(0.03)
      expect(snap.rows[0]!.windows[0]!.remaining).toBe(remaining)
    }
  })

  test("both modes keep reset and percentage colors tied to canonical severity", async () => {
    for (const window of [win({ label: "5h", remaining: 10 }), win({ label: "5h", remaining: 60, severity: "warning" })]) {
      const spans = []
      for (const displayMode of ["remaining", "used"] as const) {
        const { setup } = await frame(sidebar({ snap: snapshot(codex({ windows: [window] })), prefs: makePrefs({ displayMode }) }))
        const captured = setup.captureSpans().lines.flatMap(line => line.spans)
        const percent = captured.find(span => span.text.includes("%"))!
        const meter = captured.find(span => span.text.includes("━"))!
        const reset = captured.find(span => span.text.includes("7h 0m"))!
        expect(percent.fg).toEqual(meter.fg)
        expect(reset.fg).not.toEqual(percent.fg)
        spans.push(percent.fg)
      }
      expect(spans[0]).toEqual(spans[1])
    }
  })

  test("used collapsed summaries preserve active and fallback meter selection", async () => {
    for (const active of [true, false]) {
      const snap = snapshot(row({ windows: [win({ label: "Session", remaining: 5, resetsAt: NOW + HOUR }), win({ label: "Weekly", remaining: 78, active, resetsAt: NOW + 7 * HOUR })] }))
      const { text } = await frame(sidebar({ snap, prefs: makePrefs({ displayMode: "used", closed: ["claude-code"] }) }), 60)
      expect(text).toContain(active ? "Weekly 22% · 7h" : "Session 95% · 1h")
      expect(text).not.toContain(active ? "Session" : "Weekly")
    }
  })

  test("long labels and unknown/pending resets wrap without losing information", async () => {
    for (const displayMode of ["remaining", "used"] as const) {
      for (const width of [22, 38]) {
        const snap = snapshot(codex({ windows: [win({ label: "Extended weekly allowance", remaining: undefined, resetsAt: undefined }), win({ label: "5h", remaining: 12, resetsAt: NOW - 1 })] }))
        const { text, lines } = await frame(sidebar({ snap, width, prefs: makePrefs({ displayMode }) }), width, 70)
        const flattened = text.replace(/\s+/g, " ")
        for (const field of ["Extended weekly allowance", "reset time unknown", "unknown", "reset pending refresh", displayMode === "used" ? "88%" : "12%"]) expect(flattened).toContain(field)
        expect(Math.max(...lines.map(line => [...line].length))).toBeLessThanOrEqual(width)
        if (width < 24) expect(text).not.toMatch(/[━─]/)
      }
    }
  })

  test("shows remaining percentages with resets and highlights the current provider first", async () => {
    const { text, lines } = await frame(sidebar({ current: "claude-code" }))
    expect(text).toContain("Subscription quota")
    expect(lines.findIndex(l => l.includes("Claude · current"))).toBeLessThan(lines.findIndex(l => l.includes("Codex")))
    expect(text).toContain("78%")
    expect(text).toContain("84%")
    expect(text).toContain("Weekly ★ · 7h 0m")
    expect(text).not.toContain("resets in")
    expect(text).not.toContain("left")
  })

  test("zero is a real value: 0% with an empty bar", async () => {
    const snap = snapshot(codex({ windows: [win({ label: "5h", remaining: 0 })] }))
    const { text, lines } = await frame(sidebar({ snap }))
    expect(text).toContain("0%")
    const bar = meterAfter(lines, "5h")
    expect(bar.filled).toBe(0)
    expect(bar.empty).toBeGreaterThan(10)
  })

  test("100% remaining is a full bar", async () => {
    const snap = snapshot(codex({ windows: [win({ label: "5h", remaining: 100 })] }))
    const bar = meterAfter((await frame(sidebar({ snap }))).lines, "5h")
    expect(bar.empty).toBe(0)
    expect(bar.filled).toBeGreaterThan(10)
  })

  test("meters are proportional", async () => {
    const snap = snapshot(codex({ windows: [win({ label: "5h", remaining: 25 })] }))
    const bar = meterAfter((await frame(sidebar({ snap }))).lines, "5h")
    const ratio = bar.filled / (bar.filled + bar.empty)
    expect(ratio).toBeGreaterThan(0.2)
    expect(ratio).toBeLessThan(0.3)
  })

  test("an unknown percentage renders no bar and no fabricated value", async () => {
    const snap = snapshot(codex({ completeness: "partial", windows: [win({ label: "5h", remaining: undefined, resetsAt: NOW + HOUR })] }))
    const { text } = await frame(sidebar({ snap }))
    expect(text).toContain("unknown")
    expect(text).toContain("5h · 1h 0m")
    expect(text).not.toMatch(/[━─]/)
    expect(text).toContain("partial")
  })

  test("reset-pending after the deadline, never a refilled bar", async () => {
    const snap = snapshot(codex({ windows: [win({ label: "5h", remaining: 12, resetsAt: NOW - 5000 })] }))
    const { text, lines } = await frame(sidebar({ snap }))
    expect(text).toContain("reset pending refresh")
    expect(text).toContain("12%")
    expect(meterAfter(lines, "5h").filled).toBeLessThan(meterAfter(lines, "5h").empty)
  })

  test("stale readings carry words and the age of the observation", async () => {
    const snap = snapshot(codex({ freshness: "stale", observedAt: NOW - 8 * 60_000 }))
    const { text } = await frame(sidebar({ snap }))
    expect(text).toContain("stale")
    expect(text).toContain("updated 8m ago")
    expect(text).toContain("84%")
  })

  test("error with earlier data keeps the readings and shows what failed and what to do", async () => {
    const snap = snapshot(
      row({ state: "error", freshness: "stale", observedAt: NOW - 600_000, diagnostic: { code: "timeout", message: "m", action: "Check connectivity and refresh." } }),
    )
    const { text } = await frame(sidebar({ snap }))
    expect(text).toContain("timed out")
    expect(text).toContain("Check connectivity and refresh.")
    expect(text).toContain("78%")
  })

  test("detected providers never vanish because collection failed", async () => {
    const snap = snapshot(
      codex({ state: "incompatible_auth", windows: [], completeness: "empty", freshness: "unknown", observedAt: undefined, diagnostic: { code: "wrong_auth", message: "m", action: "Sign in with the subscription (OAuth) instead of an API key." } }),
      row({ state: "unavailable", windows: [], completeness: "empty", freshness: "unknown", observedAt: undefined, diagnostic: { code: "cli_missing", message: "m", action: "Install Claude Code on the server, or set claudeExecutable in the plugin options." } }),
    )
    const { text } = await frame(sidebar({ snap }), 44)
    expect(text).toContain("Codex")
    expect(text).toContain("needs OAuth sign-in")
    expect(text).toContain("Claude")
    expect(text).toContain("claude cli missing")
    expect(text).toContain("claudeExecutable")
    expect(text).not.toMatch(/[━─]/)
  })

  test("disconnected and loading rows are visible with meaningful words", async () => {
    const snap = snapshot(
      codex({ state: "disconnected", windows: [], completeness: "empty", freshness: "unknown", observedAt: undefined, diagnostic: { code: "not_connected", message: "m", action: "Connect this account from OpenCode, then refresh." } }),
      row({ state: "loading", windows: [], completeness: "empty", freshness: "unknown", observedAt: undefined }),
    )
    const { text } = await frame(sidebar({ snap }))
    expect(text).toContain("not connected")
    expect(text).toContain("Connect this account")
    expect(text).toContain("loading…")
  })

  test("a row collapsed to its summary uses the server's active meter and that meter's reset", async () => {
    const snap = snapshot(
      row({
        windows: [win({ id: "s", label: "Session", remaining: 5, resetsAt: NOW + HOUR }), win({ id: "w", label: "Weekly", remaining: 78, resetsAt: NOW + 7 * HOUR, active: true })],
      }),
    )
    const { text } = await frame(sidebar({ snap, prefs: makePrefs({ closed: ["claude-code"] }) }), 60)
    expect(text).toContain("Claude ▸ Weekly 78% · 7h")
    expect(text).not.toContain("Session")
  })

  test("without an active meter the summary is the lowest known window with its own reset", async () => {
    const snap = snapshot(
      row({ windows: [win({ id: "s", label: "Session", remaining: 5, resetsAt: NOW + HOUR }), win({ id: "w", label: "Weekly", remaining: 78, resetsAt: NOW + 7 * HOUR })] }),
    )
    const { text } = await frame(sidebar({ snap, prefs: makePrefs({ closed: ["claude-code"] }) }), 60)
    expect(text).toContain("Session 5% · 1h")
  })

  test("the active meter is marked when expanded", async () => {
    expect((await frame(sidebar({ snap: snapshot(row()) }))).text).toContain("Weekly ★")
  })

  test("hidden rows leave the sidebar and are counted", async () => {
    const { text } = await frame(sidebar({ prefs: makePrefs({ hidden: ["openai"] }) }))
    expect(text).not.toContain("Codex")
    expect(text).toContain("Claude")
    expect(text).toContain("1 hidden")
  })

  test("collapsing the section leaves only its header", async () => {
    const { text } = await frame(sidebar({ prefs: makePrefs({ collapsed: true }) }))
    expect(text).toContain("▸ Subscription quota")
    expect(text).not.toContain("Codex")
  })

  test("narrow terminals drop bars but keep values and errors", async () => {
    const snap = snapshot(codex(), row({ state: "error", diagnostic: { code: "forbidden", message: "m", action: "Check access." } }))
    const { text, lines } = await frame(sidebar({ snap, width: 22 }), 22)
    expect(text).not.toMatch(/[━─]/)
    expect(text).toContain("84%")
    expect(text).toContain("access denied")
    expect(Math.max(...lines.map(l => [...l].length))).toBeLessThanOrEqual(22)
  })

  test("empty state explains itself", async () => {
    expect((await frame(sidebar({ snap: snapshot() }))).text).toContain("No Codex or Claude connection found")
    expect((await frame(sidebar({ snap: snapshot(), status: "connecting" }))).text).toContain("Loading…")
  })

  test("pointer operation: header collapses, row toggles, details opens", async () => {
    const calls: string[] = []
    const { setup, lines } = await frame(
      sidebar({ open: () => calls.push("open"), toggleRow: id => calls.push(`row:${id}`), toggleCollapsed: () => calls.push("collapse") }),
    )
    const at = (needle: string) => {
      const y = lines.findIndex(line => line.includes(needle))
      return { x: lines[y]!.indexOf(needle) + 1, y }
    }
    await setup.mockMouse.click(at("Subscription").x, at("Subscription").y)
    await setup.mockMouse.click(at("Codex").x, at("Codex").y)
    await setup.mockMouse.click(at("details").x, at("details").y)
    await setup.renderOnce()
    expect(calls).toEqual(["collapse", "row:openai", "open"])
  })
})

describe("service disconnect and reconnect", () => {
  test("outage keeps readings visible, says the service is offline, and recovers", async () => {
    const [status, setStatus] = createSignal<ServiceStatus>("ok")
    const snap = snapshot(codex())
    const { setup } = await frame(() => (
      <box width={44}>
        <SidebarView snapshot={snap} status={status()} prefs={makePrefs()} now={NOW} palette={palette} width={44} onToggleCollapsed={noop} onToggleRow={noop} onOpenDetails={noop} />
      </box>
    ), 44)
    const read = () => setup.captureCharFrame()
    expect(read()).not.toContain("unavailable")
    setStatus("unavailable")
    await setup.renderOnce()
    expect(read()).toContain("Quota service unavailable")
    expect(read().replace(/\s+/g, " ")).toContain("server plugin")
    expect(read()).toContain("offline · showing last data")
    expect(read()).toContain("84%")
    expect(read()).not.toContain("access denied")
    setStatus("incompatible")
    await setup.renderOnce()
    expect(read()).toContain("version mismatch")
    setStatus("ok")
    await setup.renderOnce()
    expect(read()).not.toContain("Quota service")
    expect(read()).not.toContain("offline")
  })
})

describe("details", () => {
  test("both modes preserve collection states and diagnostics on both surfaces", async () => {
    const variants = [
      { row: codex({ freshness: "stale" }), text: "stale" },
      { row: codex({ completeness: "partial", diagnostic: { code: "partial_data", message: "Partial reading", action: "Refresh to retry." } }), text: "partial" },
      { row: codex({ state: "loading", windows: [], observedAt: undefined }), text: "loading…" },
      { row: codex({ state: "error", freshness: "stale", diagnostic: { code: "timeout", message: "Request timed out", action: "Check connectivity and refresh." } }), text: "timed out" },
    ] as const
    for (const displayMode of ["remaining", "used"] as const) {
      for (const variant of variants) {
        const snap = snapshot(variant.row)
        const prefs = makePrefs({ displayMode })
        const side = await frame(sidebar({ snap, prefs }))
        const detail = await frame(details({ snap, prefs }), 80, 70)
        expect(side.text.toLowerCase()).toContain(variant.text)
        expect(detail.text.toLowerCase()).toContain(variant.text)
        if (variant.row.windows.length) {
          for (const text of [side.text, detail.text]) expect(text).toContain(displayMode === "used" ? "16%" : "84%")
        }
        if (variant.row.diagnostic) {
          expect(detail.text).toContain(variant.row.diagnostic.message)
          expect(detail.text).toContain(variant.row.diagnostic.action)
        }
        await side.setup.dispose()
        await detail.setup.dispose()
      }
      const prefs = makePrefs({ displayMode, hidden: ["openai"] })
      expect((await frame(sidebar({ prefs }))).text).not.toContain("Codex")
      expect((await frame(details({ prefs }), 80, 70)).text).toContain("○ hidden from sidebar · show")
    }
  })

  test("lists every window with reset, source, age, states and completeness", async () => {
    const { text } = await frame(details({ selected: "claude-code", current: "claude-code" }), 80, 70)
    for (const expected of ["Session · 2h 0m", "Weekly", "100%", "78%", "Display: Remaining", "via Claude CLI on the OpenCode server", "via OpenCode OAuth connection", "ready · complete · fresh", "updated 1m ago", "CURRENT", "▸ Claude · Pro"]) {
      expect(text).toContain(expected)
    }
  })

  test("401 and 403 stay distinct with code, message, next action and retry time", async () => {
    const snap = snapshot(
      codex({ state: "error", windows: [], completeness: "empty", freshness: "unknown", observedAt: undefined, diagnostic: { code: "unauthorized", message: "The provider rejected the sign-in (HTTP 401).", action: "Reconnect the account in OpenCode to sign in again.", retryAt: NOW + 90_000 } }),
      row({ state: "error", windows: [], completeness: "empty", freshness: "unknown", observedAt: undefined, diagnostic: { code: "forbidden", message: "The provider denied access to usage (HTTP 403).", action: "Check that the account has an active subscription with usage access." } }),
    )
    const { text } = await frame(details({ snap }), 80, 70)
    expect(text).toContain("Sign-in rejected [unauthorized]")
    expect(text).toContain("HTTP 401")
    expect(text).toContain("Next: Reconnect the account in OpenCode")
    expect(text).toContain("Next retry in 1m")
    expect(text).toContain("Access denied [forbidden]")
    expect(text).toContain("HTTP 403")
    expect(text).toContain("No usage windows returned.")
    expect(text).toContain("no successful reading yet")
  })

  test("rate-limited, timeout, network, protocol and invalid-response failures are all distinguishable", async () => {
    const codes = ["rate_limited", "timeout", "network", "unsupported_protocol", "invalid_response"] as const
    const labels = ["Rate limited", "Timed out", "Network error", "CLI not supported", "Unexpected response"]
    for (const [index, code] of codes.entries()) {
      const snap = snapshot(codex({ state: "error", windows: [], completeness: "empty", diagnostic: { code, message: "msg", action: "act" } }))
      expect((await frame(details({ snap }), 80, 40)).text).toContain(`${labels[index]} [${code}]`)
    }
  })

  test("remote prerequisite: a missing Claude CLI names the server-side fix", async () => {
    const snap = snapshot(
      row({ state: "unavailable", windows: [], completeness: "empty", diagnostic: { code: "cli_missing", message: "The Claude CLI was not found on the OpenCode server.", action: "Install Claude Code on the server, or set claudeExecutable in the plugin options." } }),
    )
    const { text } = await frame(details({ snap }), 100, 40)
    expect(text).toContain("on the OpenCode server")
    expect(text).toContain("Install Claude Code on the server")
  })

  test("hidden rows remain listed, marked as hidden by preference with a way back", async () => {
    const { text } = await frame(details({ prefs: makePrefs({ hidden: ["openai"] }) }), 80, 70)
    expect(text).toContain("Codex")
    expect(text).toContain("○ hidden from sidebar · show")
    expect(text).toContain("● shown in sidebar · hide")
  })

  test("service outage is explained without blaming a provider and keeps readings", async () => {
    const { text } = await frame(details({ status: "unavailable" }), 80, 70)
    expect(text).toContain("Quota service unavailable")
    expect(text).toContain("service offline · complete · stale")
    expect(text).toContain("84%")
    expect(text).not.toContain("[forbidden]")
  })

  test("partial responses show valid windows plus the partial diagnostic", async () => {
    const snap = snapshot(codex({ completeness: "partial", diagnostic: { code: "partial_data", message: "Some usage windows were invalid and are hidden.", action: "Valid windows are shown. Refresh to retry." } }))
    const { text } = await frame(details({ snap }), 80, 50)
    expect(text).toContain("ready · partial · fresh")
    expect(text).toContain("Partial data [partial_data]")
    expect(text).toContain("84%")
  })

  test("empty state with no connections", async () => {
    expect((await frame(details({ snap: snapshot() }), 80, 20)).text).toContain("No Codex or Claude connection found")
  })

  test("shows the keyboard help and works in a narrow terminal", async () => {
    const { text, lines } = await frame(details({ width: 28 }), 30, 90)
    expect(text).toContain("↑/↓ select")
    expect(text).toContain("84%")
    expect(Math.max(...lines.map(l => [...l].length))).toBeLessThanOrEqual(30)
  })

  test("pointer operation: refresh and hide actions are wired per row", async () => {
    const calls: string[] = []
    const { setup, lines } = await frame(
      details({ snap: snapshot(codex()), onRefresh: id => calls.push(`refresh:${id}`), onToggleHidden: id => calls.push(`hide:${id}`) }),
      80,
      40,
    )
    const at = (needle: string) => {
      const y = lines.findIndex(line => line.includes(needle))
      return { x: lines[y]!.indexOf(needle) + 1, y }
    }
    await setup.mockMouse.click(at("↻ refresh").x, at("↻ refresh").y)
    await setup.mockMouse.click(at("hide").x, at("hide").y)
    await setup.renderOnce()
    expect(calls).toEqual(["refresh:openai", "hide:openai"])
  })
})
