import type { QuotaWindow, SupportedIntegration } from "../domain.ts"
import type { Source } from "../diagnostics.ts"

export interface Collection {
  windows: QuotaWindow[]
  /** True when some provider rows were invalid and dropped. */
  partial: boolean
  plan?: string
  extraUsageEnabled?: boolean
  cliVersion?: string
  /** Opaque account boundary; undefined means identity could not be verified. */
  partition?: string
  /** The source could not provide a reliable identity; readings must not be reused across failures. */
  identityUnverified?: boolean
}

export interface Collector {
  readonly integrationID: SupportedIntegration
  readonly source: Source
  collect(signal: AbortSignal): Promise<Collection>
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Finite percentage 0-100, otherwise undefined. */
export function percentValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined
}

/** Remaining percent from a used percent, rounded to avoid float noise like 77.99999. */
export function remainingFromUsed(used: number): number {
  return Math.round((100 - used) * 1e6) / 1e6
}
