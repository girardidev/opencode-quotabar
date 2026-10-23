import {
  describe,
  diagnose,
  DISCONNECTED,
  INCOMPATIBLE_AUTH,
  isAbort,
  UNAVAILABLE,
  type Source,
} from "./diagnostics.ts"
import {
  SNAPSHOT_VERSION,
  type Diagnostic,
  type QuotaRow,
  type QuotaSnapshot,
  type QuotaWindow,
  type SupportedIntegration,
} from "./domain.ts"
import { connectionKey, discover, type Detected, type DiscoveryPort } from "./discovery.ts"
import type { Collection, Collector } from "./collectors/types.ts"
import { systemClock, type Clock } from "./options.ts"

export const LEASE_MS = 120_000
export const BACKOFF_BASE_MS = 30_000
export const BACKOFF_CAP_MS = 900_000

const SOURCES: Record<SupportedIntegration, Source> = { openai: "opencode-oauth", "claude-code": "claude-cli" }

interface Entry {
  id: SupportedIntegration
  name: string
  detected: Detected
  key: string | undefined
  generation: number
  controller?: AbortController
  inflight?: Promise<void>
  partition?: string
  /** Earlier readings may be shown as stale only when the account was verified. */
  reusable: boolean
  windows: QuotaWindow[]
  partial: boolean
  plan?: string
  extraUsageEnabled?: boolean
  cliVersion?: string
  observedAt?: number
  attemptedAt?: number
  nextAllowedAt: number
  failures: number
  lastOk: boolean
  diagnostic?: Diagnostic
}

export interface ServiceDeps {
  discovery: DiscoveryPort
  collector(detected: Detected): Collector
  ttlMs: number
  emit(snapshot: QuotaSnapshot): void
  clock?: Clock
}

/** Per-location scheduler: independent collectors, one in-flight request per account, in-memory only. */
export class QuotaService {
  private readonly entries = new Map<SupportedIntegration, Entry>()
  private readonly clock: Clock
  private lastActive = Number.NEGATIVE_INFINITY
  private syncing?: Promise<void>
  private disposed = false

  constructor(private readonly deps: ServiceDeps) {
    this.clock = deps.clock ?? systemClock
  }

  /** Renews the activity lease. */
  touch() {
    this.lastActive = this.clock.now()
  }

  get active() {
    return this.clock.now() - this.lastActive <= LEASE_MS
  }

  /** Current rows. Renews activity and starts due collections, but never bypasses a valid TTL. */
  async snapshot(): Promise<QuotaSnapshot> {
    this.touch()
    await this.sync()
    this.kickDue()
    return this.view()
  }

  /** Manual refresh bypasses the successful-read TTL, never failure backoff. */
  async manual(id?: SupportedIntegration): Promise<QuotaSnapshot> {
    this.touch()
    await this.sync()
    const targets = [...this.entries.values()].filter(entry => !id || entry.id === id)
    await Promise.allSettled(targets.map(entry => this.start(entry)))
    return this.view()
  }

  /** Periodic hook. Does nothing when no client has renewed the lease. */
  async tick() {
    if (this.disposed || !this.active) return
    await this.sync()
    this.kickDue()
  }

  /** Re-evaluates connections now, e.g. after a credential change event. */
  async reconcile() {
    if (this.disposed) return
    await this.sync()
    if (this.active) this.kickDue()
  }

  dispose() {
    this.disposed = true
    for (const entry of this.entries.values()) this.reset(entry)
    this.entries.clear()
  }

  private async sync(): Promise<void> {
    if (this.syncing) return this.syncing
    this.syncing = this.doSync().finally(() => (this.syncing = undefined))
    return this.syncing
  }

  private async doSync() {
    let detected: Detected[]
    try {
      detected = await discover(this.deps.discovery)
    } catch {
      return // Host lookup failed; keep what we have and retry on the next tick.
    }
    if (this.disposed) return
    let changed = false
    const seen = new Set<SupportedIntegration>()
    for (const item of detected) {
      seen.add(item.id)
      const key = connectionKey(item.connection)
      const entry = this.entries.get(item.id)
      if (!entry) {
        this.entries.set(item.id, this.create(item, key))
        changed = true
        continue
      }
      entry.detected = item
      entry.name = item.name
      if (entry.key !== key) {
        this.reset(entry)
        entry.key = key
        changed = true
      }
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue
      this.reset(entry)
      this.entries.delete(id)
      changed = true
    }
    if (changed) this.emit()
  }

  private create(detected: Detected, key: string | undefined): Entry {
    return {
      id: detected.id,
      name: detected.name,
      detected,
      key,
      generation: 0,
      reusable: false,
      windows: [],
      partial: false,
      nextAllowedAt: 0,
      failures: 0,
      lastOk: false,
    }
  }

  /** Aborts work and forgets readings: the account (or the entry) is no longer the same. */
  private reset(entry: Entry) {
    entry.generation++
    entry.controller?.abort()
    entry.controller = undefined
    entry.inflight = undefined
    entry.partition = undefined
    entry.reusable = false
    entry.windows = []
    entry.partial = false
    entry.plan = undefined
    entry.extraUsageEnabled = undefined
    entry.cliVersion = undefined
    entry.observedAt = undefined
    entry.attemptedAt = undefined
    entry.nextAllowedAt = 0
    entry.failures = 0
    entry.lastOk = false
    entry.diagnostic = undefined
  }

  private kickDue() {
    const now = this.clock.now()
    for (const entry of this.entries.values()) if (this.isDue(entry, now)) void this.start(entry)
  }

  /** A collector that authenticates on its own (the Claude CLI) does not need a host connection. */
  private connectable(entry: Entry): boolean {
    return Boolean(entry.detected.connection) || !entry.detected.connectionRequired
  }

  private isDue(entry: Entry, now: number): boolean {
    if (!this.connectable(entry) || entry.inflight || now < entry.nextAllowedAt) return false
    if (entry.attemptedAt === undefined || !entry.lastOk) return true
    if (entry.observedAt === undefined || now - entry.observedAt >= this.deps.ttlMs) return true
    // A passed reset deadline asks for a fresh read; it never marks anything replenished.
    return entry.windows.some(w => w.resetsAt !== undefined && w.resetsAt <= now && entry.attemptedAt! < w.resetsAt)
  }

  /** Starts a collection now. Callers decide TTL/due-ness; failure backoff is enforced here for everyone. */
  private start(entry: Entry): Promise<void> {
    if (entry.inflight) return entry.inflight
    if (!this.connectable(entry)) {
      this.markDisconnected(entry)
      return Promise.resolve()
    }
    const now = this.clock.now()
    if (now < entry.nextAllowedAt) return Promise.resolve() // backoff applies to manual refresh too
    return this.run(entry)
  }

  private markDisconnected(entry: Entry) {
    const diagnostic = describe("not_connected")
    if (entry.diagnostic?.code === diagnostic.code) return
    this.reset(entry)
    entry.diagnostic = diagnostic
    this.emit()
  }

  private run(entry: Entry): Promise<void> {
    const generation = entry.generation
    const controller = new AbortController()
    entry.controller = controller
    const task = (async () => {
      try {
        const collector = this.deps.collector(entry.detected)
        const result = await collector.collect(controller.signal)
        if (this.disposed || generation !== entry.generation) return
        this.succeed(entry, result)
      } catch (error) {
        if (this.disposed || generation !== entry.generation || controller.signal.aborted || isAbort(error)) return
        this.fail(entry, error)
      } finally {
        if (generation === entry.generation) {
          entry.inflight = undefined
          entry.controller = undefined
        }
        if (!this.disposed) this.emit()
      }
    })()
    entry.inflight = task
    this.emit()
    return task
  }

  private succeed(entry: Entry, result: Collection) {
    const now = this.clock.now()
    entry.partition = result.partition
    entry.reusable = result.partition !== undefined
    entry.windows = result.windows
    entry.partial = result.partial
    entry.plan = result.plan
    entry.extraUsageEnabled = result.extraUsageEnabled
    entry.cliVersion = result.cliVersion
    entry.observedAt = now
    entry.attemptedAt = now
    entry.failures = 0
    entry.nextAllowedAt = 0
    entry.lastOk = true
    entry.diagnostic = result.partial
      ? describe("partial_data")
      : result.identityUnverified
        ? describe("identity_unverified")
        : undefined
  }

  private fail(entry: Entry, error: unknown) {
    const now = this.clock.now()
    const diagnostic = diagnose(error)
    entry.failures++
    const exponential = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (entry.failures - 1))
    // Jitter stays below the cap; Retry-After is a lower bound and may exceed it.
    const delay = exponential * (0.75 + 0.25 * this.clock.random())
    entry.nextAllowedAt = Math.max(now + delay, diagnostic.retryAt ?? 0)
    entry.attemptedAt = now
    entry.lastOk = false
    entry.diagnostic = { ...diagnostic, retryAt: entry.nextAllowedAt }
    // Earlier readings survive only for a verified account that did not just change.
    if (!entry.reusable || diagnostic.code === "account_mismatch") {
      entry.partition = undefined
      entry.reusable = false
      entry.windows = []
      entry.partial = false
      entry.plan = undefined
      entry.extraUsageEnabled = undefined
      entry.observedAt = undefined
    }
  }

  private emit() {
    if (!this.disposed) this.deps.emit(this.view())
  }

  view(): QuotaSnapshot {
    const now = this.clock.now()
    const rows = [...this.entries.values()].map(entry => this.row(entry, now))
    return { version: SNAPSHOT_VERSION, rows, refreshing: [...this.entries.values()].some(entry => entry.inflight) }
  }

  private row(entry: Entry, now: number): QuotaRow {
    const connected = this.connectable(entry)
    const diagnostic = connected ? entry.diagnostic : (entry.diagnostic ?? describe("not_connected"))
    let state: QuotaRow["state"]
    if (!connected) state = "disconnected"
    else if (diagnostic && !entry.lastOk && DISCONNECTED.has(diagnostic.code)) state = "disconnected"
    else if (diagnostic && !entry.lastOk && INCOMPATIBLE_AUTH.has(diagnostic.code)) state = "incompatible_auth"
    else if (diagnostic && !entry.lastOk && UNAVAILABLE.has(diagnostic.code)) state = "unavailable"
    else if (diagnostic && !entry.lastOk) state = "error"
    else if (entry.lastOk) state = "ready"
    else state = "loading"

    const freshness: QuotaRow["freshness"] =
      entry.observedAt === undefined
        ? "unknown"
        : entry.lastOk && now - entry.observedAt <= this.deps.ttlMs * 2 + 30_000
          ? "fresh"
          : "stale"
    const completeness: QuotaRow["completeness"] = entry.windows.length === 0
      ? "empty"
      : entry.partial || entry.windows.some(w => w.remaining === undefined)
        ? "partial"
        : "complete"
    const retrying = entry.failures > 0 && entry.nextAllowedAt > now

    return {
      id: entry.id,
      name: entry.name,
      source: SOURCES[entry.id],
      ...(entry.partition ? { partition: entry.partition } : {}),
      state,
      completeness,
      freshness,
      windows: entry.windows,
      ...(entry.plan ? { plan: entry.plan } : {}),
      ...(entry.extraUsageEnabled !== undefined ? { extraUsageEnabled: entry.extraUsageEnabled } : {}),
      ...(entry.cliVersion ? { cliVersion: entry.cliVersion } : {}),
      ...(entry.observedAt !== undefined ? { observedAt: entry.observedAt } : {}),
      ...(entry.attemptedAt !== undefined ? { attemptedAt: entry.attemptedAt } : {}),
      ...(retrying ? { nextRetryAt: entry.nextAllowedAt } : {}),
      ...(diagnostic ? { diagnostic } : {}),
    }
  }
}
