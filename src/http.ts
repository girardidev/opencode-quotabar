import { CollectError, isAbort } from "./diagnostics.ts"

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export interface JsonRequest {
  url: string
  headers: Record<string, string>
  timeoutMs: number
  maxBytes: number
  signal?: AbortSignal
  fetch?: FetchLike
  now?: () => number
}

/** Parses Retry-After (delta-seconds or HTTP date) into an epoch ms deadline. */
export function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return now + seconds * 1000
  const date = Date.parse(value)
  return Number.isFinite(date) ? date : undefined
}

async function readBounded(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      void reader.cancel().catch(() => {})
      throw new CollectError("invalid_response")
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/**
 * Bounded GET returning parsed JSON. Maps failures to allowlisted codes; the
 * Authorization header and response body never leave this function.
 */
export async function getJson(request: JsonRequest): Promise<unknown> {
  if (request.signal?.aborted) throw abortReason(request.signal)
  const now = request.now ?? Date.now
  const fetcher = request.fetch ?? ((url, init) => fetch(url, init))
  const timeout = AbortSignal.timeout(request.timeoutMs)
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout
  let response: Response
  try {
    response = await fetcher(request.url, {
      method: "GET",
      headers: { Accept: "application/json", ...request.headers },
      redirect: "error",
      signal,
    })
  } catch (error) {
    if (request.signal?.aborted) throw error
    if (timeout.aborted || isAbort(error)) throw new CollectError("timeout")
    throw new CollectError("network")
  }
  if (!response.ok) {
    void response.body?.cancel().catch(() => {})
    if (response.status === 401) throw new CollectError("unauthorized")
    if (response.status === 403) throw new CollectError("forbidden")
    if (response.status === 429) throw new CollectError("rate_limited", parseRetryAfter(response.headers.get("retry-after"), now()))
    throw new CollectError("upstream_error", response.status >= 500 ? parseRetryAfter(response.headers.get("retry-after"), now()) : undefined)
  }
  let text: string
  try {
    text = await readBounded(response, request.maxBytes)
  } catch (error) {
    if (error instanceof CollectError) throw error
    if (request.signal?.aborted) throw error
    throw new CollectError(timeout.aborted ? "timeout" : "network")
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new CollectError("invalid_response")
  }
}

function abortReason(signal: AbortSignal): Error {
  const error = new Error("aborted")
  error.name = "AbortError"
  return signal.reason instanceof Error ? signal.reason : error
}
