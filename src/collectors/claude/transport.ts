import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CollectError } from "../../diagnostics.ts"
import { isRecord } from "../types.ts"

/**
 * Prompt-free Claude CLI control channel. Sends only `initialize` and
 * `get_usage` over stream-json stdio; no user message is ever written.
 * The control protocol is experimental and may change between CLI releases.
 */
export const CLAUDE_ARGS: readonly string[] = [
  "-p",
  "--output-format", "stream-json",
  "--verbose",
  "--input-format", "stream-json",
  "--no-session-persistence",
  "--safe-mode",
  "--tools", "",
  "--strict-mcp-config",
  "--setting-sources", "",
]

/** Provider/credential overrides removed so the CLI uses its own first-party login. */
export const STRIPPED_ENV: readonly string[] = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
  "NODE_OPTIONS",
  "DEBUG",
]

export function buildChildEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...base }
  for (const key of STRIPPED_ENV) delete env[key]
  return env
}

export interface ClaudeAccount {
  email?: string
  organization?: string
  subscriptionType?: string
  apiProvider?: string
}

export interface RawClaudeUsage {
  account: ClaudeAccount
  /** Second `initialize` after `get_usage`; undefined if the CLI did not answer it. */
  accountAfter?: ClaudeAccount
  cliVersion?: string
  usage: unknown
}

export type SpawnFn = typeof nodeSpawn

export interface TransportOptions {
  executable: string
  timeoutMs: number
  maxOutputBytes: number
  signal: AbortSignal
  env?: NodeJS.ProcessEnv
  spawn?: SpawnFn
  /** Grace periods for terminating the child; overridable for tests. */
  graceMs?: number
}

const MAX_STDERR = 8192

function readAccount(value: unknown): ClaudeAccount {
  if (!isRecord(value)) return {}
  const text = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 256 ? v : undefined)
  return {
    email: text(value.email),
    organization: text(value.organization),
    subscriptionType: text(value.subscriptionType),
    apiProvider: text(value.apiProvider),
  }
}

/** Maps CLI stderr to an allowlisted code without ever forwarding the text. */
export function classifyStderr(stderr: string): CollectError {
  if (/unknown (option|argument)|unrecognized|invalid (option|argument)|unexpected argument|did you mean/i.test(stderr))
    return new CollectError("unsupported_protocol")
  if (/log ?in|not authenticated|authenticat|unauthori[sz]ed|sign ?in|credential/i.test(stderr)) return new CollectError("cli_signed_out")
  return new CollectError("cli_error")
}

function classifyControlError(text: unknown): CollectError {
  const message = typeof text === "string" ? text : ""
  if (/log ?in|not authenticated|authenticat|unauthori[sz]ed|sign ?in|credential/i.test(message)) return new CollectError("cli_signed_out")
  return new CollectError("unsupported_protocol")
}

export async function runClaudeUsage(options: TransportOptions): Promise<RawClaudeUsage> {
  const { signal } = options
  if (signal.aborted) throw abortError()
  const spawnFn = options.spawn ?? nodeSpawn
  const cwd = await mkdtemp(join(tmpdir(), "quota-claude-"))
  let child: ChildProcessWithoutNullStreams | undefined
  let exited = false
  let failure: Error | undefined
  const waiters = new Map<string, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }>()
  let stderr = ""
  let stdoutBytes = 0
  let buffer = ""
  let counter = 0
  let failFast: (error: Error) => void = () => {}
  const failed = new Promise<never>((_, reject) => (failFast = reject))
  failed.catch(() => {})

  const fail = (error: Error) => {
    if (failure) return
    failure = error
    for (const waiter of waiters.values()) waiter.reject(error)
    waiters.clear()
    failFast(error)
  }

  const timer = setTimeout(() => fail(new CollectError("timeout")), options.timeoutMs)
  const onAbort = () => fail(abortError())
  signal.addEventListener("abort", onAbort, { once: true })

  const handleLine = (line: string) => {
    if (!line.trim()) return
    let message: unknown
    try {
      message = JSON.parse(line)
    } catch {
      return fail(new CollectError("invalid_response"))
    }
    if (!isRecord(message) || message.type !== "control_response" || !isRecord(message.response)) return
    const response = message.response
    const id = typeof response.request_id === "string" ? response.request_id : undefined
    const waiter = id ? waiters.get(id) : undefined
    if (!id || !waiter) return // unrelated or uncorrelated: never becomes quota data
    waiters.delete(id)
    if (response.subtype === "success") waiter.resolve(isRecord(response.response) ? response.response : {})
    else waiter.reject(classifyControlError(response.error))
  }

  const request = (subtype: string, extra: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      if (failure) return reject(failure)
      const id = `quota-${++counter}`
      waiters.set(id, { resolve, reject })
      child!.stdin.write(`${JSON.stringify({ type: "control_request", request_id: id, request: { subtype, ...extra } })}\n`, error => {
        if (error) setImmediate(() => fail(classifyStderr(stderr)))
      })
    })

  try {
    child = spawnFn(options.executable, [...CLAUDE_ARGS], {
      cwd,
      env: buildChildEnv(options.env ?? process.env),
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    })
    const proc = child
    proc.on("error", error => {
      exited = true
      const code = (error as NodeJS.ErrnoException).code
      fail(new CollectError(code === "ENOENT" ? "cli_missing" : "cli_error"))
    })
    proc.on("exit", () => {
      exited = true
      if (!failure && waiters.size) fail(classifyStderr(stderr))
    })
    proc.stdin.on("error", () => {})
    proc.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_STDERR) stderr += chunk.toString("utf8", 0, MAX_STDERR - stderr.length)
    })
    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength
      if (stdoutBytes > options.maxOutputBytes) return fail(new CollectError("invalid_response"))
      buffer += chunk.toString("utf8")
      let newline: number
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        handleLine(line)
        if (failure) return
      }
    })

    const step = <T>(promise: Promise<T>) => Promise.race([promise, failed])
    const init = await step(request("initialize"))
    const usage = await step(request("get_usage", { skip_behaviors: true }))
    // A repeated initialize re-reads the account; a differing identity discards the result upstream.
    const again = await step(request("initialize")).catch(error => {
      if (error instanceof CollectError && error.code === "timeout") return undefined
      if (signal.aborted) throw error
      return undefined
    })
    const version = typeof init.claude_code_version === "string" ? init.claude_code_version.slice(0, 32) : undefined
    return {
      account: readAccount(init.account),
      accountAfter: again ? readAccount(again.account) : undefined,
      cliVersion: version,
      usage,
    }
  } finally {
    clearTimeout(timer)
    signal.removeEventListener("abort", onAbort)
    waiters.clear()
    if (child) await terminate(child, () => exited, !failure, options.graceMs ?? 1000)
    await rm(cwd, { recursive: true, force: true }).catch(() => {})
  }
}

function abortError(): Error {
  const error = new Error("aborted")
  error.name = "AbortError"
  return error
}

/** Closes stdin, then SIGTERM, then SIGKILL, and waits until the child is reaped. */
async function terminate(child: ChildProcessWithoutNullStreams, hasExited: () => boolean, graceful: boolean, graceMs: number) {
  const waitExit = (ms: number) =>
    new Promise<boolean>(resolve => {
      if (hasExited() || child.exitCode !== null || child.signalCode !== null) return resolve(true)
      const timer = setTimeout(() => resolve(false), ms)
      child.once("exit", () => {
        clearTimeout(timer)
        resolve(true)
      })
    })
  try {
    child.stdin.end()
  } catch {}
  if (graceful && (await waitExit(graceMs))) return
  if (!hasExited()) child.kill("SIGTERM")
  if (await waitExit(graceMs)) return
  child.kill("SIGKILL")
  await waitExit(2000)
}
