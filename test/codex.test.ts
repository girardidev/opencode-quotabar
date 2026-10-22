import { describe, expect, test } from "bun:test"
import { CODEX_USAGE_URL, createCodexCollector, parseCodexUsage, type CodexCredential } from "../src/collectors/codex.ts"
import { CollectError } from "../src/diagnostics.ts"
import { parseRetryAfter } from "../src/http.ts"
import { leaksAny } from "../src/redact.ts"
import { SECRETS } from "./helpers.ts"

const NOW = 1_800_000_000_000
const payload = {
  rate_limit: {
    primary_window: { used_percent: 16, limit_window_seconds: 18000, reset_at: 1_800_003_600 },
    secondary_window: { used_percent: 3, limit_window_seconds: 604800, reset_after_seconds: 7200 },
  },
}

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init })

function collector(options: {
  credential?: CodexCredential | undefined
  fetch?: (url: string, init: RequestInit) => Promise<Response>
  timeout?: number
}) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const instance = createCodexCollector({
    connectionKey: "credential:cred_x",
    resolve: async () => ("credential" in options ? options.credential : { type: "oauth", access: "oauth-ACCESS-secret", accountId: "acct-PRIVATE-id" }),
    httpTimeoutMs: options.timeout ?? 1000,
    maxOutputBytes: 10_000,
    now: () => NOW,
    fetch: async (url, init) => {
      calls.push({ url, init })
      return (options.fetch ?? (async () => json(payload)))(url, init)
    },
  })
  return { instance, calls }
}

const signal = () => new AbortController().signal

async function code(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error instanceof CollectError ? error.code : "other"
  }
  return "none"
}

describe("parseCodexUsage", () => {
  test("keeps independent windows with their own remaining and reset", () => {
    const { windows, partial } = parseCodexUsage(payload, NOW)
    expect(partial).toBe(false)
    expect(windows).toEqual([
      { id: "primary", label: "5h", remaining: 84, resetsAt: 1_800_003_600_000, active: false },
      { id: "secondary", label: "Weekly", remaining: 97, resetsAt: NOW + 7_200_000, active: false },
    ])
  })

  test("zero used is 100% remaining and fully used is 0", () => {
    const { windows } = parseCodexUsage({ rate_limit: { primary_window: { used_percent: 0 }, secondary_window: { used_percent: 100 } } }, NOW)
    expect(windows.map(w => w.remaining)).toEqual([100, 0])
  })

  test("a missing window is simply absent", () => {
    const { windows } = parseCodexUsage({ rate_limit: { primary_window: payload.rate_limit.primary_window } }, NOW)
    expect(windows.map(w => w.id)).toEqual(["primary"])
  })

  test("invalid percentages never become healthy values", () => {
    const { windows, partial } = parseCodexUsage({ rate_limit: { primary_window: { used_percent: 250 }, secondary_window: payload.rate_limit.secondary_window } }, NOW)
    expect(partial).toBe(true)
    expect(windows.map(w => w.id)).toEqual(["secondary"])
  })

  test("only invalid windows is a schema error", () => {
    expect(() => parseCodexUsage({ rate_limit: { primary_window: { used_percent: "x" } } }, NOW)).toThrow(CollectError)
  })

  test("window with reset but no percentage keeps remaining unknown", () => {
    const { windows } = parseCodexUsage({ rate_limit: { primary_window: { reset_at: 1_800_003_600 } } }, NOW)
    expect(windows[0]!.remaining).toBeUndefined()
    expect(windows[0]!.resetsAt).toBe(1_800_003_600_000)
  })

  test("null rate_limit is an explicit empty reading; a missing one is a format error", () => {
    expect(parseCodexUsage({ rate_limit: null }, NOW).windows).toEqual([])
    expect(() => parseCodexUsage({}, NOW)).toThrow(CollectError)
    expect(() => parseCodexUsage([], NOW)).toThrow(CollectError)
  })
})

describe("codex collector", () => {
  test("sends the OAuth token and account header to the usage endpoint only", async () => {
    const { instance, calls } = collector({})
    const result = await instance.collect(signal())
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(CODEX_USAGE_URL)
    const headers = calls[0]!.init.headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer oauth-ACCESS-secret")
    expect(headers["ChatGPT-Account-Id"]).toBe("acct-PRIVATE-id")
    expect(calls[0]!.init.redirect).toBe("error")
    expect(result.windows).toHaveLength(2)
    expect(leaksAny(result, SECRETS)).toBe(false)
    expect(result.partition).toMatch(/^[0-9a-f]{16}$/)
  })

  test("omits the account header when the connection has none", async () => {
    const { instance, calls } = collector({ credential: { type: "oauth", access: "oauth-ACCESS-secret" } })
    await instance.collect(signal())
    expect((calls[0]!.init.headers as Record<string, string>)["ChatGPT-Account-Id"]).toBeUndefined()
  })

  test("API keys are rejected before any request", async () => {
    const { instance, calls } = collector({ credential: { type: "key" } })
    expect(await code(instance.collect(signal()))).toBe("wrong_auth")
    expect(calls).toHaveLength(0)
  })

  test("missing connection", async () => {
    const { instance, calls } = collector({ credential: undefined })
    expect(await code(instance.collect(signal()))).toBe("not_connected")
    expect(calls).toHaveLength(0)
  })

  test("401, 403 and 429 stay distinct", async () => {
    const status = (n: number, headers: Record<string, string> = {}) =>
      collector({ fetch: async () => new Response("secret body oauth-ACCESS-secret", { status: n, headers }) }).instance.collect(signal())
    expect(await code(status(401))).toBe("unauthorized")
    expect(await code(status(403))).toBe("forbidden")
    expect(await code(status(429))).toBe("rate_limited")
    expect(await code(status(500))).toBe("upstream_error")
  })

  test("429 carries Retry-After as a deadline", async () => {
    const { instance } = collector({ fetch: async () => new Response("", { status: 429, headers: { "retry-after": "120" } }) })
    await expect(instance.collect(signal())).rejects.toMatchObject({ code: "rate_limited", retryAt: NOW + 120_000 })
  })

  test("malformed JSON, network failure and timeout", async () => {
    expect(await code(collector({ fetch: async () => new Response("{nope") }).instance.collect(signal()))).toBe("invalid_response")
    expect(await code(collector({ fetch: async () => { throw new TypeError("secret oauth-ACCESS-secret") } }).instance.collect(signal()))).toBe("network")
    const slow = collector({
      timeout: 30,
      fetch: (_url, init) => new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("t", "TimeoutError")))),
    })
    expect(await code(slow.instance.collect(signal()))).toBe("timeout")
  })

  test("oversized bodies are rejected", async () => {
    const big = collector({ fetch: async () => new Response("x".repeat(50_000)) })
    expect(await code(big.instance.collect(signal()))).toBe("invalid_response")
  })

  test("caller cancellation propagates as an abort, not a provider failure", async () => {
    const controller = new AbortController()
    const { instance } = collector({
      fetch: (_url, init) =>
        new Promise((_, reject) => {
          if (init.signal!.aborted) return reject(new DOMException("a", "AbortError"))
          init.signal!.addEventListener("abort", () => reject(new DOMException("a", "AbortError")))
        }),
    })
    const promise = instance.collect(controller.signal)
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: "AbortError" })
  })
})

describe("parseRetryAfter", () => {
  test("delta seconds, HTTP dates and garbage", () => {
    expect(parseRetryAfter("30", NOW)).toBe(NOW + 30_000)
    expect(parseRetryAfter(new Date(NOW + 5000).toUTCString(), NOW)).toBe(Math.floor((NOW + 5000) / 1000) * 1000)
    expect(parseRetryAfter("soon", NOW)).toBeUndefined()
    expect(parseRetryAfter(null, NOW)).toBeUndefined()
  })
})
