import type { PluginOptions } from "@opencode/plugin"

/** Validated, bounded plugin options. Out-of-range numbers are clamped; invalid values use defaults. */
export interface QuotaOptions {
  /** Successful-read TTL. */
  readonly ttlMs: number
  readonly httpTimeoutMs: number
  readonly claudeTimeoutMs: number
  /** Claude executable resolved in the server environment. */
  readonly claudeExecutable: string
  /** Cap on bytes captured from a collector child process or HTTP body. */
  readonly maxOutputBytes: number
}

export const DEFAULTS = {
  ttlSeconds: 120,
  httpTimeoutMs: 10_000,
  claudeTimeoutMs: 30_000,
  claudeExecutable: "claude",
  maxOutputBytes: 1_048_576,
} as const

export const BOUNDS = {
  ttlSeconds: [30, 3600],
  httpTimeoutMs: [1000, 60_000],
  claudeTimeoutMs: [5000, 60_000],
  maxOutputBytes: [16_384, 8_388_608],
} as const

function bounded(value: unknown, fallback: number, [min, max]: readonly [number, number]) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}

export function parseOptions(raw: PluginOptions | undefined): QuotaOptions {
  const input = raw ?? {}
  const executable = input.claudeExecutable
  return {
    ttlMs: bounded(input.refreshTtlSeconds, DEFAULTS.ttlSeconds, BOUNDS.ttlSeconds) * 1000,
    httpTimeoutMs: bounded(input.httpTimeoutMs, DEFAULTS.httpTimeoutMs, BOUNDS.httpTimeoutMs),
    claudeTimeoutMs: bounded(input.claudeTimeoutMs, DEFAULTS.claudeTimeoutMs, BOUNDS.claudeTimeoutMs),
    claudeExecutable:
      typeof executable === "string" && executable.trim() && !/[\0\n\r]/.test(executable)
        ? executable.trim()
        : DEFAULTS.claudeExecutable,
    maxOutputBytes: Math.floor(bounded(input.maxOutputBytes, DEFAULTS.maxOutputBytes, BOUNDS.maxOutputBytes)),
  }
}

/** Injectable time source so scheduling is deterministic in tests. */
export interface Clock {
  now(): number
  random(): number
}

export const systemClock: Clock = { now: () => Date.now(), random: () => Math.random() }
