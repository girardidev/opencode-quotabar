import { CollectError } from "../../diagnostics.ts"
import { partitionKey } from "../../redact.ts"
import type { Collection, Collector } from "../types.ts"
import { parseClaudeUsage } from "./usage.ts"
import { runClaudeUsage, type ClaudeAccount, type RawClaudeUsage, type TransportOptions } from "./transport.ts"

export interface ClaudeDeps {
  /** Stable private id of the OpenChamber connection marker, when there is one. It is never sent anywhere. */
  connectionKey?: string
  executable: string
  timeoutMs: number
  maxOutputBytes: number
  /** Overridable for tests. */
  run?: (options: TransportOptions) => Promise<RawClaudeUsage>
  env?: NodeJS.ProcessEnv
  spawn?: TransportOptions["spawn"]
  graceMs?: number
}

function identity(account: ClaudeAccount): string {
  return partitionKey(account.email, account.organization, account.subscriptionType)
}

/**
 * Reads subscription usage through the server-local Claude CLI. The OpenCode
 * connection is only enrollment; the CLI owns authentication.
 */
export function createClaudeCollector(deps: ClaudeDeps): Collector {
  const run = deps.run ?? runClaudeUsage
  return {
    integrationID: "claude-code",
    source: "claude-cli",
    async collect(signal): Promise<Collection> {
      const raw = await run({
        executable: deps.executable,
        timeoutMs: deps.timeoutMs,
        maxOutputBytes: deps.maxOutputBytes,
        signal,
        env: deps.env,
        spawn: deps.spawn,
        graceMs: deps.graceMs,
      })
      const { account } = raw
      // 3P/API-key sessions cannot report claude.ai plan limits.
      if (account.apiProvider !== undefined && account.apiProvider !== "firstParty") throw new CollectError("cli_signed_out")
      if (raw.accountAfter && identity(raw.accountAfter) !== identity(account)) throw new CollectError("account_mismatch")
      const usage = parseClaudeUsage(raw.usage)
      const verified = Boolean(account.email || account.organization)
      const plan = usage.plan ?? account.subscriptionType
      return {
        windows: usage.windows,
        partial: usage.partial,
        ...(plan ? { plan } : {}),
        ...(usage.extraUsageEnabled !== undefined ? { extraUsageEnabled: usage.extraUsageEnabled } : {}),
        ...(raw.cliVersion ? { cliVersion: raw.cliVersion } : {}),
        ...(verified
          ? { partition: partitionKey("claude-code", deps.connectionKey, account.email, account.organization, account.subscriptionType) }
          : { identityUnverified: true }),
      }
    },
  }
}
