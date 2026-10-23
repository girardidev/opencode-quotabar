import { INTEGRATIONS, type SupportedIntegration } from "./domain.ts"

/** Host-agnostic view of an active connection. `handle` is passed back to the host to resolve it. */
export interface HostConnection {
  kind: "credential" | "env"
  /** Credential id or env var name. Private: used for change detection and partitioning only. */
  id: string
  method?: "key" | "oauth" | "external"
  handle: unknown
}

export interface DiscoveryPort {
  integrations(): Promise<ReadonlyArray<{ id: string; name: string }>>
  providers(): Promise<ReadonlyArray<{ id: string; integrationID?: string | null }>>
  activeConnection(integrationID: string): Promise<HostConnection | undefined>
}

export interface Detected {
  id: SupportedIntegration
  name: string
  connection?: HostConnection
  /** False when the collector authenticates on its own, so a missing connection is not a fault. */
  connectionRequired: boolean
}

const DISPLAY: Record<SupportedIntegration, string> = { openai: "Codex", "claude-code": "Claude" }

const CONNECTION_REQUIRED: Record<SupportedIntegration, boolean> = { openai: true, "claude-code": false }

/**
 * Provider identifiers that enroll an integration, besides its own id. The integration list
 * enumerates everything the host knows, so only the provider list can tell that Anthropic is in use.
 */
const PROVIDER_IDS: Record<SupportedIntegration, readonly string[]> = {
  openai: ["openai"],
  "claude-code": ["claude-code", "anthropic"],
}

/**
 * Finds the supported integrations by explicit identifier. A detected integration is
 * always returned, even when no usable connection exists, so it can explain itself.
 */
export async function discover(port: DiscoveryPort): Promise<Detected[]> {
  const [integrations, providers] = await Promise.all([port.integrations(), port.providers()])
  const found: Detected[] = []
  for (const id of INTEGRATIONS) {
    const integration = integrations.some(entry => entry.id === id)
    const provider = providers.some(entry => PROVIDER_IDS[id].some(match => entry.id === match || entry.integrationID === match))
    if (!integration && !provider) continue
    // Connections hang off the integration id; a provider without one cannot be connected.
    const connection = integration ? await port.activeConnection(id) : undefined
    found.push({ id, name: DISPLAY[id], connectionRequired: CONNECTION_REQUIRED[id], ...(connection ? { connection } : {}) })
  }
  return found
}

/** Changes when the active connection (and therefore potentially the account) changes. */
export function connectionKey(connection: HostConnection | undefined): string | undefined {
  return connection ? `${connection.kind}:${connection.id}:${connection.method ?? ""}` : undefined
}
