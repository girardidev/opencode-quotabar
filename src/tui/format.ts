import type { DiagnosticCode, QuotaRow, QuotaWindow } from "../domain.ts"
import type { DisplayMode } from "./model.ts"

/** Whole-number remaining percent that never rounds a used quota up to 100% or an available one down to 0%. */
export function formatPercent(value: number): string {
  const rounded = Math.round(value)
  if (value > 0 && rounded === 0) return "<1%"
  if (value < 100 && rounded === 100) return "99%"
  return `${rounded}%`
}

export function formatRemaining(window: QuotaWindow): string {
  return window.remaining === undefined ? "unknown" : `${formatPercent(window.remaining)} left`
}

/** Convert before rounding, without mutating the provider's canonical remaining value. */
export function displayPercent(window: QuotaWindow, mode: DisplayMode): number | undefined {
  if (window.remaining === undefined) return undefined
  return mode === "used" ? 100 - window.remaining : window.remaining
}

export function formatAllowance(window: QuotaWindow, mode: DisplayMode): string {
  const value = displayPercent(window, mode)
  return value === undefined ? "unknown" : formatPercent(value)
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "<1m"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

/** Compact duration for tight spaces: the largest unit only. */
export function formatShort(ms: number): string {
  const text = formatDuration(ms)
  return text === "<1m" ? text : (text.split(" ")[0] ?? text)
}

/** A passed deadline reads "reset pending", never "full": only a fresh reading confirms replenishment. */
export function formatReset(resetsAt: number | undefined, now: number, short = false): string {
  if (resetsAt === undefined) return "reset time unknown"
  if (resetsAt <= now) return "reset pending refresh"
  const left = resetsAt - now
  return `resets in ${short ? formatShort(left) : formatDuration(left)}`
}

/** Omit only the countdown prefix; unknown and pending deadlines remain explicit. */
export function formatCompactReset(resetsAt: number | undefined, now: number, short = false): string {
  return formatReset(resetsAt, now, short).replace(/^resets in /, "")
}

export function formatAge(timestamp: number | undefined, now: number): string {
  if (timestamp === undefined) return "no successful reading yet"
  const age = Math.max(0, now - timestamp)
  return age < 60_000 ? "updated just now" : `updated ${formatDuration(age)} ago`
}

/** The server's headline meter when supplied, otherwise the lowest known remaining window. */
export function headline(row: QuotaRow | undefined): QuotaWindow | undefined {
  if (!row?.windows) return undefined
  const active = row.windows.find(window => window.active && window.remaining !== undefined)
  if (active) return active
  const known = row.windows.filter(window => window.remaining !== undefined)
  if (!known.length) return row.windows.find(window => window.active) ?? row.windows[0]
  return known.reduce((lowest, window) => (window.remaining! < lowest.remaining! ? window : lowest))
}

export const CODE_LABEL: Record<DiagnosticCode, string> = {
  not_connected: "Not connected",
  wrong_auth: "OAuth sign-in required",
  cli_missing: "Claude CLI missing",
  cli_signed_out: "Claude CLI signed out",
  account_mismatch: "Account changed",
  identity_unverified: "Account unverified",
  unsupported_protocol: "CLI not supported",
  cli_error: "CLI error",
  unauthorized: "Sign-in rejected",
  forbidden: "Access denied",
  rate_limited: "Rate limited",
  timeout: "Timed out",
  network: "Network error",
  upstream_error: "Provider error",
  invalid_response: "Unexpected response",
  partial_data: "Partial data",
}

/** One short textual status so state never depends on color alone. */
export function statusText(row: QuotaRow, serviceDown = false): string {
  if (serviceDown) return "offline · showing last data"
  switch (row.state) {
    case "loading":
      return "loading…"
    case "disconnected":
      return "not connected"
    case "incompatible_auth":
      return "needs OAuth sign-in"
    case "unavailable":
    case "error":
      return row.diagnostic ? CODE_LABEL[row.diagnostic.code].toLowerCase() : row.state
    case "ready":
      return row.completeness === "partial" ? "partial" : row.freshness === "stale" ? "stale" : ""
  }
}

export function sourceText(row: QuotaRow): string {
  return row.source === "claude-cli" ? "via Claude CLI on the OpenCode server" : "via OpenCode OAuth connection"
}

export function planText(row: QuotaRow): string | undefined {
  return row.plan ? row.plan.charAt(0).toUpperCase() + row.plan.slice(1) : undefined
}
