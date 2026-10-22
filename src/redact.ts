import { createHash } from "node:crypto"

/** One-way, short partition key. Inputs are private (ids, emails) and never leave the process. */
export function partitionKey(...parts: ReadonlyArray<string | undefined>): string {
  const hash = createHash("sha256")
  for (const part of parts) hash.update(`${part ?? ""}\0`)
  return hash.digest("hex").slice(0, 16)
}

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e]", "g")

/** Strips control characters and bounds provider-supplied labels before display. */
export function safeLabel(value: unknown, max = 40): string | undefined {
  if (typeof value !== "string") return undefined
  const cleaned = value.replace(CONTROL_CHARS, "").trim()
  if (!cleaned) return undefined
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned
}

/** Test helper: true if serialized data contains any of the given secrets. */
export function leaksAny(value: unknown, secrets: readonly string[]): boolean {
  const text = JSON.stringify(value) ?? ""
  return secrets.some(secret => secret.length > 0 && text.includes(secret))
}
