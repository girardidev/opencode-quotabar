import { z } from "zod"

/** Bump when the RPC snapshot shape changes incompatibly. */
export const SNAPSHOT_VERSION = 1 as const

/** Stable, allowlisted failure codes. Raw upstream/CLI text never crosses the RPC boundary. */
export const DIAGNOSTIC_CODES = [
  "not_connected",
  "wrong_auth",
  "cli_missing",
  "cli_signed_out",
  "account_mismatch",
  "identity_unverified",
  "unsupported_protocol",
  "cli_error",
  "unauthorized",
  "forbidden",
  "rate_limited",
  "timeout",
  "network",
  "upstream_error",
  "invalid_response",
  "partial_data",
] as const
export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number]

export const diagnosticSchema = z.object({
  code: z.enum(DIAGNOSTIC_CODES),
  message: z.string(),
  action: z.string(),
  /** Epoch ms of the earliest automatic or manual retry, when known. */
  retryAt: z.number().optional(),
})
export type Diagnostic = z.infer<typeof diagnosticSchema>

export const windowSchema = z.object({
  id: z.string(),
  label: z.string(),
  group: z.string().optional(),
  /** Model or surface the window applies to, when provider-scoped. */
  scope: z.string().optional(),
  /** Percent remaining 0-100. Absent means unknown, never zero. */
  remaining: z.number().min(0).max(100).optional(),
  /** Epoch ms. Absent means unknown. */
  resetsAt: z.number().optional(),
  severity: z.string().optional(),
  /** Provider-designated headline meter. */
  active: z.boolean(),
})
export type QuotaWindow = z.infer<typeof windowSchema>

export const INTEGRATIONS = ["openai", "claude-code"] as const
export type SupportedIntegration = (typeof INTEGRATIONS)[number]

export const rowSchema = z.object({
  /** Integration id; one row per supported integration per location. */
  id: z.enum(INTEGRATIONS),
  name: z.string(),
  /** Which authentication source feeds this row. */
  source: z.enum(["opencode-oauth", "claude-cli"]),
  /** Opaque account boundary. Changes when the account changes; never derived reversibly. */
  partition: z.string().optional(),
  state: z.enum(["loading", "ready", "disconnected", "incompatible_auth", "unavailable", "error"]),
  completeness: z.enum(["complete", "partial", "empty"]),
  freshness: z.enum(["fresh", "stale", "unknown"]),
  windows: z.array(windowSchema),
  plan: z.string().optional(),
  extraUsageEnabled: z.boolean().optional(),
  cliVersion: z.string().optional(),
  /** Epoch ms of the last successful observation. Not advanced by failed attempts. */
  observedAt: z.number().optional(),
  /** Epoch ms of the latest attempt, successful or not. */
  attemptedAt: z.number().optional(),
  nextRetryAt: z.number().optional(),
  diagnostic: diagnosticSchema.optional(),
})
export type QuotaRow = z.infer<typeof rowSchema>

export const snapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  rows: z.array(rowSchema),
  refreshing: z.boolean(),
})
export type QuotaSnapshot = z.infer<typeof snapshotSchema>

export const EMPTY_SNAPSHOT: QuotaSnapshot = { version: SNAPSHOT_VERSION, rows: [], refreshing: false }
