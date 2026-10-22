import { CollectError } from "../../diagnostics.ts"
import type { QuotaWindow } from "../../domain.ts"
import { safeLabel } from "../../redact.ts"
import { isRecord, percentValue, remainingFromUsed } from "../types.ts"

export interface ParsedClaudeUsage {
  windows: QuotaWindow[]
  /** Some rows were invalid and dropped. */
  partial: boolean
  plan?: string
  extraUsageEnabled?: boolean
}

function parseReset(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : undefined
}

function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, " ").trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Usage"
}

function scopeName(scope: unknown): string | undefined {
  if (!isRecord(scope)) return undefined
  const model = isRecord(scope.model) ? safeLabel(scope.model.display_name) : undefined
  const surface = isRecord(scope.surface) ? safeLabel(scope.surface.display_name) : undefined
  return model ?? surface
}

function rowLabel(kind: string, group: string | undefined, scope: string | undefined): string {
  if (kind === "session") return "Session"
  if (kind === "weekly_all") return "Weekly"
  if (kind === "weekly_scoped") return scope ? `Weekly · ${scope}` : "Weekly (scoped)"
  const base = humanize(kind)
  return scope ? `${base} · ${scope}` : group && group !== kind ? `${base} (${humanize(group)})` : base
}

/** Server rows win; they carry their own scope, severity, order and headline pick. */
function parseLimits(limits: unknown[]): { windows: QuotaWindow[]; invalid: number } {
  const windows: QuotaWindow[] = []
  let invalid = 0
  limits.forEach((row, index) => {
    if (!isRecord(row)) return void invalid++
    const kind = safeLabel(row.kind, 32)
    if (!kind) return void invalid++
    const percent = row.percent === null || row.percent === undefined ? undefined : percentValue(row.percent)
    // A present-but-invalid percentage must never read as healthy; drop the row.
    if (row.percent !== null && row.percent !== undefined && percent === undefined) return void invalid++
    const group = safeLabel(row.group, 32)
    const scope = scopeName(row.scope)
    const severity = safeLabel(row.severity, 16)
    const resetsAt = parseReset(row.resets_at)
    windows.push({
      id: `${kind}:${scope ?? ""}:${index}`,
      label: rowLabel(kind, group, scope),
      ...(group ? { group } : {}),
      ...(scope ? { scope } : {}),
      ...(percent !== undefined ? { remaining: remainingFromUsed(percent) } : {}),
      ...(resetsAt !== undefined ? { resetsAt } : {}),
      ...(severity ? { severity } : {}),
      active: row.is_active === true,
    })
  })
  return { windows, invalid }
}

const LEGACY: ReadonlyArray<readonly [key: string, label: string]> = [
  ["five_hour", "Session"],
  ["seven_day", "Weekly"],
  ["seven_day_opus", "Weekly · Opus"],
  ["seven_day_sonnet", "Weekly · Sonnet"],
  ["seven_day_oauth_apps", "Weekly · OAuth apps"],
]

/** Legacy report percentages are 0-100 used, never fractions. Null windows are simply absent. */
function parseLegacy(limits: Record<string, unknown>): { windows: QuotaWindow[]; invalid: number } {
  const windows: QuotaWindow[] = []
  let invalid = 0
  for (const [key, label] of LEGACY) {
    const entry = limits[key]
    if (entry === undefined || entry === null) continue
    if (!isRecord(entry)) {
      invalid++
      continue
    }
    const raw = entry.utilization
    const used = raw === null || raw === undefined ? undefined : percentValue(raw)
    if (raw !== null && raw !== undefined && used === undefined) {
      invalid++
      continue
    }
    const resetsAt = parseReset(entry.resets_at)
    if (used === undefined && resetsAt === undefined) continue
    windows.push({
      id: `legacy:${key}`,
      label,
      ...(used !== undefined ? { remaining: remainingFromUsed(used) } : {}),
      ...(resetsAt !== undefined ? { resetsAt } : {}),
      active: false,
    })
  }
  return { windows, invalid }
}

/**
 * Normalizes a `get_usage` control response. Throws allowlisted CollectErrors for
 * non-subscription sessions and unusable shapes.
 */
export function parseClaudeUsage(response: unknown): ParsedClaudeUsage {
  if (!isRecord(response)) throw new CollectError("invalid_response")
  if (response.rate_limits_available === false) throw new CollectError("cli_signed_out")
  const limits = response.rate_limits
  if (limits === null || limits === undefined) {
    // The CLI could not fetch plan limits: not a subscription session or the fetch is failing.
    throw new CollectError(response.rate_limits_available === true ? "upstream_error" : "invalid_response")
  }
  if (!isRecord(limits)) throw new CollectError("invalid_response")

  // Absent/null rows -> legacy fields. An explicit empty list means "no meters", not "reconstruct".
  const rows = limits.limits
  const parsed = Array.isArray(rows) ? parseLimits(rows) : parseLegacy(limits)
  if (parsed.invalid > 0 && parsed.windows.length === 0) throw new CollectError("invalid_response")

  const extra = limits.extra_usage
  const plan = typeof response.subscription_type === "string" ? safeLabel(response.subscription_type, 24) : undefined
  return {
    windows: parsed.windows,
    partial: parsed.invalid > 0,
    ...(plan ? { plan } : {}),
    ...(isRecord(extra) && typeof extra.is_enabled === "boolean" ? { extraUsageEnabled: extra.is_enabled } : {}),
  }
}
