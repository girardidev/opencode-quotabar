#!/usr/bin/env bun
// Fake Claude CLI speaking the stream-json control protocol. Scenario via FAKE_CLAUDE_SCENARIO.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"

const scenario = process.env.FAKE_CLAUDE_SCENARIO ?? "ok"
const log = process.env.FAKE_CLAUDE_LOG
const usage = JSON.parse(readFileSync(new URL("./claude-usage.json", import.meta.url), "utf8"))
if (process.env.FAKE_CLAUDE_PID) writeFileSync(process.env.FAKE_CLAUDE_PID, String(process.pid))
if (log) {
  const env = Object.fromEntries(
    ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_BASE_URL", "PATH", "HOME"].map(k => [k, process.env[k] ?? null]),
  )
  appendFileSync(log, `${JSON.stringify({ kind: "start", argv: process.argv.slice(2), cwd: process.cwd(), env })}\n`)
}

if (scenario === "flag-error") {
  process.stderr.write("error: unknown option '--safe-mode'\n")
  process.exit(2)
}
if (scenario === "stderr-secret") {
  process.stderr.write("fatal: token sk-ant-SECRET-key for person@example.test rejected\n")
  process.exit(1)
}
if (scenario === "signed-out-exit") {
  process.stderr.write("Not logged in. Please run /login\n")
  process.exit(1)
}
if (scenario === "stubborn") process.on("SIGTERM", () => {})

const account = { email: "person@example.test", organization: "Example Org", subscriptionType: "pro", apiProvider: "firstParty" }
let initCount = 0
const out = (value: unknown) => process.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value)}\n`)
const reply = (id: string, response: unknown) => out({ type: "control_response", response: { subtype: "success", request_id: id, response } })

async function fragmented(id: string, response: unknown) {
  const line = JSON.stringify({ type: "control_response", response: { subtype: "success", request_id: id, response } })
  for (let i = 0; i < line.length; i += 7) {
    process.stdout.write(line.slice(i, i + 7))
    await new Promise(resolve => setTimeout(resolve, 1))
  }
  process.stdout.write("\n")
}

async function handle(request: any) {
  if (log) appendFileSync(log, `${JSON.stringify({ kind: "recv", message: request })}\n`)
  if (request.type !== "control_request") return
  const id = request.request_id as string
  const subtype = request.request?.subtype as string
  if (scenario === "hang" || scenario === "stubborn") return
  if (scenario === "malformed") return out("this is not json")
  if (scenario === "oversized") return out(JSON.stringify({ type: "system", blob: "x".repeat(2_000_000) }))
  if (scenario === "unrelated") {
    out({ type: "system", subtype: "init", session_id: "s" })
    out({ type: "control_response", response: { subtype: "success", request_id: "someone-else", response: { rate_limits: { limits: [{ kind: "x", group: "x", percent: 99 }] } } } })
    out({ type: "keep_alive" })
  }
  if (subtype === "initialize") {
    initCount++
    const current = scenario === "identity-race" && initCount > 1 ? { ...account, email: "other@example.test" } : account
    const shown = scenario === "no-identity" ? { apiProvider: "firstParty", subscriptionType: "pro" } : scenario === "third-party" ? { apiProvider: "bedrock" } : current
    const body = { account: shown, claude_code_version: "9.9.9-fake", commands: [] }
    return scenario === "fragmented" ? fragmented(id, body) : reply(id, body)
  }
  if (subtype === "get_usage") {
    if (scenario === "unsupported-op") return out({ type: "control_response", response: { subtype: "error", request_id: id, error: "Unknown control request subtype: get_usage" } })
    if (scenario === "signed-out") return reply(id, { ...usage, rate_limits_available: false, rate_limits: null, subscription_type: null })
    return scenario === "fragmented" ? fragmented(id, usage) : reply(id, usage)
  }
  out({ type: "control_response", response: { subtype: "error", request_id: id, error: "unsupported" } })
}

let buffer = ""
process.stdin.on("data", chunk => {
  buffer += chunk.toString()
  let i
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i)
    buffer = buffer.slice(i + 1)
    if (line.trim()) void handle(JSON.parse(line))
  }
})
process.stdin.on("end", () => {
  if (scenario === "hang" || scenario === "stubborn") return
  setTimeout(() => process.exit(0), 5)
})
