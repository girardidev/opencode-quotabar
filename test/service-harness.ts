import type { Collection, Collector } from "../src/collectors/types.ts"
import { CollectError } from "../src/diagnostics.ts"
import type { Detected, DiscoveryPort, HostConnection } from "../src/discovery.ts"
import type { QuotaSnapshot, QuotaWindow, SupportedIntegration } from "../src/domain.ts"
import { QuotaService } from "../src/service.ts"
import { TestClock } from "./helpers.ts"

export const conn = (id: string, method: HostConnection["method"] = "oauth"): HostConnection => ({ kind: "credential", id, method, handle: { id } })

export function windows(remaining = 80, resetsAt?: number): QuotaWindow[] {
  return [{ id: "w", label: "Weekly", remaining, ...(resetsAt !== undefined ? { resetsAt } : {}), active: false }]
}

export interface Call {
  id: SupportedIntegration
  signal: AbortSignal
  settled: boolean
  resolve(value?: Partial<Collection>): void
  reject(error: unknown): void
}

export function harness(options: { ttlMs?: number } = {}) {
  const clock = new TestClock()
  const state = {
    integrations: [
      { id: "openai", name: "OpenAI" },
      { id: "claude-code", name: "Claude Code" },
    ] as Array<{ id: string; name: string }>,
    providers: [{ id: "openai" }, { id: "claude-code", integrationID: null }] as Array<{ id: string; integrationID?: string | null }>,
    connections: new Map<string, HostConnection | undefined>([
      ["openai", conn("cred_openai")],
      ["claude-code", conn("cred_marker")],
    ]),
  }
  const discovery: DiscoveryPort = {
    integrations: async () => state.integrations,
    providers: async () => state.providers,
    activeConnection: async id => state.connections.get(id),
  }
  const calls: Call[] = []
  const events: QuotaSnapshot[] = []
  const service = new QuotaService({
    discovery,
    ttlMs: options.ttlMs ?? 120_000,
    clock,
    emit: snapshot => events.push(snapshot),
    collector(detected: Detected): Collector {
      return {
        integrationID: detected.id,
        source: detected.id === "openai" ? "opencode-oauth" : "claude-cli",
        collect: signal =>
          new Promise<Collection>((resolve, reject) => {
            const call: Call = {
              id: detected.id,
              signal,
              settled: false,
              resolve: value => {
                call.settled = true
                resolve({ windows: windows(), partial: false, partition: `${detected.id}-acct`, ...value })
              },
              reject: error => {
                call.settled = true
                reject(error)
              },
            }
            calls.push(call)
          }),
      }
    },
  })
  const pending = (id?: SupportedIntegration) => calls.filter(call => !call.settled && !call.signal.aborted && (!id || call.id === id))
  const row = (snapshot: QuotaSnapshot, id: SupportedIntegration) => snapshot.rows.find(r => r.id === id)!
  /** Lets queued microtasks and the promise chain settle. */
  const settle = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
    await new Promise(resolve => setImmediate(resolve))
  }
  return { clock, state, service, calls, events, pending, row, settle }
}

export const fail = (code: ConstructorParameters<typeof CollectError>[0], retryAt?: number) => new CollectError(code, retryAt)
