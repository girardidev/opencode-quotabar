import { CollectError } from "../diagnostics.ts"
import type { QuotaWindow } from "../domain.ts"
import { getJson, type FetchLike } from "../http.ts"
import { partitionKey } from "../redact.ts"
import { isRecord, percentValue, remainingFromUsed, type Collection, type Collector } from "./types.ts"

export const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage"

/** What the host exposes about the active OpenAI connection. Key values are never exposed here. */
export type CodexCredential = { type: "oauth"; access: string; accountId?: string } | { type: "key" }

export interface CodexDeps {
  /** Stable private id of the connection (used only for the account partition). */
  connectionKey: string
  resolve(): Promise<CodexCredential | undefined>
  httpTimeoutMs: number
  maxOutputBytes: number
  fetch?: FetchLike
  now?: () => number
}

function durationLabel(seconds: unknown): string | undefined {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return undefined
  if (seconds % 604800 === 0) return seconds === 604800 ? "Weekly" : `${seconds / 604800}w`
  if (seconds % 86400 === 0) return `${seconds / 86400}d`
  if (seconds % 3600 === 0) return `${seconds / 3600}h`
  if (seconds % 60 === 0) return `${seconds / 60}m`
  return undefined
}

function parseWindow(
  id: string,
  fallback: string,
  value: unknown,
  now: number,
): { window?: QuotaWindow; invalid: boolean } {
  if (value === undefined || value === null) return { invalid: false }
  if (!isRecord(value)) return { invalid: true }
  const used = value.used_percent
  const remaining = used === undefined || used === null ? undefined : percentValue(used)
  if (used !== undefined && used !== null && remaining === undefined) return { invalid: true }
  const resetAt = typeof value.reset_at === "number" && Number.isFinite(value.reset_at) && value.reset_at > 0 ? value.reset_at * 1000 : undefined
  const after = value.reset_after_seconds
  const resetsAt =
    resetAt ?? (typeof after === "number" && Number.isFinite(after) && after >= 0 ? now + after * 1000 : undefined)
  if (remaining === undefined && resetsAt === undefined) return { invalid: false }
  return {
    invalid: false,
    window: {
      id,
      label: durationLabel(value.limit_window_seconds) ?? fallback,
      ...(remaining !== undefined ? { remaining: remainingFromUsed(remaining) } : {}),
      ...(resetsAt !== undefined ? { resetsAt } : {}),
      active: false,
    },
  }
}

/** Normalizes the Codex usage payload. Independent windows stay independent; zero stays zero. */
export function parseCodexUsage(payload: unknown, now: number): { windows: QuotaWindow[]; partial: boolean } {
  if (!isRecord(payload) || !("rate_limit" in payload)) throw new CollectError("invalid_response")
  const limit = payload.rate_limit
  if (limit === null) return { windows: [], partial: false }
  if (!isRecord(limit)) throw new CollectError("invalid_response")
  const parsed = [
    parseWindow("primary", "Primary", limit.primary_window, now),
    parseWindow("secondary", "Secondary", limit.secondary_window, now),
  ]
  const windows = parsed.flatMap(entry => (entry.window ? [entry.window] : []))
  const partial = parsed.some(entry => entry.invalid)
  if (partial && !windows.length) throw new CollectError("invalid_response")
  return { windows, partial }
}

export function createCodexCollector(deps: CodexDeps): Collector {
  return {
    integrationID: "openai",
    source: "opencode-oauth",
    async collect(signal): Promise<Collection> {
      const credential = await deps.resolve()
      if (!credential) throw new CollectError("not_connected")
      // API keys cannot read subscription usage; fail before any request carries the key.
      if (credential.type !== "oauth") throw new CollectError("wrong_auth")
      const now = deps.now ?? Date.now
      const payload = await getJson({
        url: CODEX_USAGE_URL,
        headers: {
          Authorization: `Bearer ${credential.access}`,
          ...(credential.accountId ? { "ChatGPT-Account-Id": credential.accountId } : {}),
        },
        timeoutMs: deps.httpTimeoutMs,
        maxBytes: deps.maxOutputBytes,
        signal,
        fetch: deps.fetch,
        now,
      })
      const { windows, partial } = parseCodexUsage(payload, now())
      return { windows, partial, partition: partitionKey("openai", deps.connectionKey, credential.accountId) }
    },
  }
}
