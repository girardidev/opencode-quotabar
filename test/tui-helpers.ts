import { SNAPSHOT_VERSION, type QuotaRow, type QuotaSnapshot, type QuotaWindow } from "../src/domain.ts"
import { DEFAULT_PREFS, type Prefs } from "../src/tui/model.ts"
import type { Palette } from "../src/tui/views.tsx"

export const NOW = 1_800_000_000_000
export const HOUR = 3_600_000

export const palette: Palette = {
  base: "#ffffff",
  muted: "#888888",
  success: "#00ff00",
  warning: "#ffaa00",
  error: "#ff0000",
  border: "#444444",
  accent: "#00aaff",
}

export const win = (over: Partial<QuotaWindow> = {}): QuotaWindow => ({ id: "w", label: "Weekly", remaining: 78, resetsAt: NOW + 7 * HOUR, active: false, ...over })

export function row(over: Partial<QuotaRow> = {}): QuotaRow {
  return {
    id: "claude-code",
    name: "Claude",
    source: "claude-cli",
    state: "ready",
    completeness: "complete",
    freshness: "fresh",
    windows: [win({ id: "s", label: "Session", remaining: 100, resetsAt: NOW + 2 * HOUR }), win({ active: true })],
    plan: "pro",
    observedAt: NOW - 60_000,
    attemptedAt: NOW - 60_000,
    ...over,
  }
}

export const codex = (over: Partial<QuotaRow> = {}) =>
  row({ id: "openai", name: "Codex", source: "opencode-oauth", plan: undefined, windows: [win({ id: "p", label: "5h", remaining: 84 }), win({ id: "q", label: "Weekly", remaining: 97 })], ...over })

export const snapshot = (...rows: QuotaRow[]): QuotaSnapshot => ({ version: SNAPSHOT_VERSION, rows, refreshing: false })
export const prefs = (over: Partial<Prefs> = {}): Prefs => ({ ...DEFAULT_PREFS, ...over })
