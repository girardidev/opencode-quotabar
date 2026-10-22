import type { CodexCredential } from "./collectors/codex.ts"
import type { DiscoveryPort, HostConnection } from "./discovery.ts"

/** The slice of the OpenCode plugin context this package uses. Narrow so tests can fake it. */
export interface HostContext {
  integration: {
    list(): Promise<{ data: ReadonlyArray<{ id: string; name: string }> }>
    connection: {
      active(integrationID: string): Promise<unknown>
      resolve(connection: never): Promise<unknown>
    }
  }
  provider: {
    list(): Promise<{ data: ReadonlyArray<{ id: string; integrationID?: string | null }> }>
  }
}

type RawConnection =
  | { type: "credential"; id: string; method: "key" | "oauth" | "external" }
  | { type: "env"; name: string }

function isConnection(value: unknown): value is RawConnection {
  return typeof value === "object" && value !== null && "type" in value
}

export function hostDiscovery(host: HostContext): DiscoveryPort {
  return {
    integrations: async () => (await host.integration.list()).data,
    providers: async () => (await host.provider.list()).data,
    async activeConnection(integrationID): Promise<HostConnection | undefined> {
      const connection = await host.integration.connection.active(integrationID)
      if (!isConnection(connection)) return undefined
      if (connection.type === "credential") {
        return { kind: "credential", id: String(connection.id), method: connection.method, handle: connection }
      }
      if (connection.type === "env") return { kind: "env", id: String(connection.name), handle: connection }
      return undefined
    },
  }
}

/** Resolves the OpenAI connection; only the OAuth access token and account selector leave the host. */
export function hostCodexCredential(host: HostContext, connection: HostConnection): () => Promise<CodexCredential | undefined> {
  return async () => {
    const value = (await host.integration.connection.resolve(connection.handle as never)) as
      | { type?: string; access?: unknown; metadata?: Record<string, unknown> }
      | undefined
    if (!value) return undefined
    if (value.type === "oauth" && typeof value.access === "string") {
      const accountId = value.metadata?.accountId
      return { type: "oauth", access: value.access, ...(typeof accountId === "string" && accountId ? { accountId } : {}) }
    }
    return { type: "key" }
  }
}
