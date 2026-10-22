import type { Diagnostic, DiagnosticCode } from "./domain.ts"

export type Source = "opencode-oauth" | "claude-cli"

/** Failure carrying only an allowlisted code. Its message is never shown to clients. */
export class CollectError extends Error {
  constructor(
    readonly code: DiagnosticCode,
    readonly retryAt?: number,
  ) {
    super(code)
    this.name = "CollectError"
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
}

type Text = { message: string; action: string }

const COMMON: Record<DiagnosticCode, Text> = {
  not_connected: { message: "No active connection.", action: "Connect this account from OpenCode, then refresh." },
  wrong_auth: {
    message: "The active connection cannot report subscription usage.",
    action: "Sign in with the subscription (OAuth) instead of an API key.",
  },
  cli_missing: {
    message: "The Claude CLI was not found on the OpenCode server.",
    action: "Install Claude Code on the server, or set claudeExecutable in the plugin options.",
  },
  cli_signed_out: {
    message: "The Claude CLI on the OpenCode server is not signed in with a claude.ai subscription.",
    action: "Run `claude` on the server machine and sign in with your subscription.",
  },
  account_mismatch: {
    message: "The Claude CLI account changed during the request.",
    action: "Refresh to read the current account.",
  },
  identity_unverified: {
    message: "The Claude CLI did not report an account identity, so earlier readings cannot be reused.",
    action: "Readings are shown as-is and not retained across failures.",
  },
  unsupported_protocol: {
    message: "This Claude CLI version does not support the usage control request.",
    action: "Update Claude Code on the server. Tested with 2.1.306.",
  },
  cli_error: { message: "The Claude CLI failed before returning usage.", action: "Run `claude` on the server to check it works, then refresh." },
  unauthorized: {
    message: "The provider rejected the sign-in (HTTP 401).",
    action: "Reconnect the account in OpenCode to sign in again.",
  },
  forbidden: {
    message: "The provider denied access to usage (HTTP 403).",
    action: "Check that the account has an active subscription with usage access.",
  },
  rate_limited: { message: "The provider is throttling usage requests (HTTP 429).", action: "Wait for the retry time shown, then refresh." },
  timeout: { message: "The usage request timed out.", action: "Check connectivity and refresh." },
  network: { message: "The usage request could not reach the provider.", action: "Check connectivity and refresh." },
  upstream_error: { message: "The provider returned an error for the usage request.", action: "Try again later." },
  invalid_response: {
    message: "The usage response had an unexpected format.",
    action: "The provider may have changed its format. Update the plugin.",
  },
  partial_data: { message: "Some usage windows were invalid and are hidden.", action: "Valid windows are shown. Refresh to retry." },
}

export function describe(code: DiagnosticCode, retryAt?: number): Diagnostic {
  const text = COMMON[code]
  return { code, message: text.message, action: text.action, ...(retryAt !== undefined ? { retryAt } : {}) }
}

/** Convert any failure into an allowlisted diagnostic. Raw error text is dropped on purpose. */
export function diagnose(error: unknown): Diagnostic {
  if (error instanceof CollectError) return describe(error.code, error.retryAt)
  return describe("upstream_error")
}

/** Codes that mean the connection/auth choice is wrong rather than a transient fault. */
export const INCOMPATIBLE_AUTH: ReadonlySet<DiagnosticCode> = new Set(["wrong_auth"])
export const DISCONNECTED: ReadonlySet<DiagnosticCode> = new Set(["not_connected"])
/** Prerequisites on the server that the user must fix. */
export const UNAVAILABLE: ReadonlySet<DiagnosticCode> = new Set([
  "cli_missing",
  "cli_signed_out",
  "unsupported_protocol",
  "account_mismatch",
])
