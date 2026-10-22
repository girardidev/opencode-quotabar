import { EMPTY_SNAPSHOT, snapshotSchema, type QuotaSnapshot, type SupportedIntegration } from "../domain.ts"
import type { ServiceStatus } from "./model.ts"

/** Transport to the server half. The TUI holds no credentials and never talks to providers. */
export interface QuotaPort {
  snapshot(): Promise<unknown>
  refresh(integrationID?: SupportedIntegration): Promise<unknown>
  onUpdated(listener: (snapshot: unknown) => void): () => void
  onReconnect(listener: () => void): () => void
}

export interface ControllerState {
  snapshot: QuotaSnapshot
  status: ServiceStatus
  /** The last good snapshot predates the current outage. */
  stale: boolean
}

/**
 * Keeps the last good snapshot and tells transport failure apart from provider failure:
 * when the RPC service is unreachable, readings stay visible, flagged offline, and no
 * provider is blamed.
 */
export class QuotaController {
  private current: ControllerState = { snapshot: EMPTY_SNAPSHOT, status: "connecting", stale: false }
  private readonly listeners = new Set<(state: ControllerState) => void>()
  private readonly disposers: Array<() => void> = []
  private busy: Promise<void> | undefined
  private disposed = false

  constructor(private readonly port: QuotaPort) {}

  get state(): ControllerState {
    return this.current
  }

  subscribe(listener: (state: ControllerState) => void): () => void {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  start() {
    this.disposers.push(this.port.onUpdated(raw => this.accept(raw)))
    this.disposers.push(this.port.onReconnect(() => void this.sync()))
    return this.sync()
  }

  /** Polling also renews the server's activity lease; refresh asks for an out-of-TTL read. */
  sync(refresh = false, integrationID?: SupportedIntegration): Promise<void> {
    if (this.disposed) return Promise.resolve()
    // A manual refresh must not be swallowed by an in-flight passive sync.
    if (this.busy && !refresh) return this.busy
    const previous = this.busy
    const run = (async () => {
      await previous?.catch(() => {})
      try {
        this.accept(refresh ? await this.port.refresh(integrationID) : await this.port.snapshot())
      } catch {
        this.fail("unavailable")
      }
    })()
    const tracked = run.finally(() => {
      if (this.busy === tracked) this.busy = undefined
    })
    this.busy = tracked
    return tracked
  }

  dispose() {
    this.disposed = true
    for (const dispose of this.disposers.splice(0)) dispose()
    this.listeners.clear()
  }

  private accept(raw: unknown) {
    if (this.disposed) return
    const parsed = snapshotSchema.safeParse(raw)
    if (!parsed.success) return this.fail("incompatible")
    this.set({ snapshot: parsed.data, status: "ok", stale: false })
  }

  private fail(status: "unavailable" | "incompatible") {
    if (this.disposed) return
    this.set({ snapshot: this.current.snapshot, status, stale: this.current.snapshot.rows.length > 0 })
  }

  private set(state: ControllerState) {
    this.current = state
    for (const listener of this.listeners) listener(state)
  }
}
