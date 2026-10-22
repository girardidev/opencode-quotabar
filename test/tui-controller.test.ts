import { describe, expect, test } from "bun:test"
import { QuotaController, type QuotaPort } from "../src/tui/controller.ts"
import { codex, row, snapshot } from "./tui-helpers.ts"

function port(initial: unknown) {
  const state = {
    snapshotResult: initial as unknown,
    snapshotError: undefined as Error | undefined,
    snapshots: 0,
    refreshes: [] as Array<string | undefined>,
    updated: undefined as ((value: unknown) => void) | undefined,
    reconnect: undefined as (() => void) | undefined,
    disposed: 0,
    gate: undefined as Promise<void> | undefined,
  }
  const p: QuotaPort = {
    snapshot: async () => {
      state.snapshots++
      await state.gate
      if (state.snapshotError) throw state.snapshotError
      return state.snapshotResult
    },
    refresh: async id => {
      state.refreshes.push(id)
      if (state.snapshotError) throw state.snapshotError
      return state.snapshotResult
    },
    onUpdated: listener => ((state.updated = listener), () => void state.disposed++),
    onReconnect: listener => ((state.reconnect = listener), () => void state.disposed++),
  }
  return { state, p }
}

describe("QuotaController", () => {
  test("accepts valid snapshots and pushes updates", async () => {
    const { state, p } = port(snapshot(codex()))
    const controller = new QuotaController(p)
    expect(controller.state.status).toBe("connecting")
    await controller.start()
    expect(controller.state.status).toBe("ok")
    expect(controller.state.snapshot.rows).toHaveLength(1)
    state.updated!(snapshot(codex(), row()))
    expect(controller.state.snapshot.rows).toHaveLength(2)
  })

  test("service outage keeps prior readings, flags them stale and blames no provider", async () => {
    const { state, p } = port(snapshot(codex(), row()))
    const controller = new QuotaController(p)
    await controller.start()
    state.snapshotError = new Error("rpc.unavailable")
    await controller.sync()
    expect(controller.state.status).toBe("unavailable")
    expect(controller.state.stale).toBe(true)
    expect(controller.state.snapshot.rows.map(r => r.state)).toEqual(["ready", "ready"])
  })

  test("outage before any data shows an empty, unavailable service", async () => {
    const { state, p } = port(undefined)
    state.snapshotError = new Error("down")
    const controller = new QuotaController(p)
    await controller.start()
    expect(controller.state.status).toBe("unavailable")
    expect(controller.state.stale).toBe(false)
    expect(controller.state.snapshot.rows).toEqual([])
  })

  test("a snapshot from an incompatible server is rejected, keeping the old one", async () => {
    const { state, p } = port(snapshot(codex()))
    const controller = new QuotaController(p)
    await controller.start()
    state.snapshotResult = { version: 2, rows: [{ nope: true }], refreshing: false }
    await controller.sync()
    expect(controller.state.status).toBe("incompatible")
    expect(controller.state.snapshot.rows).toHaveLength(1)
    state.updated!({ garbage: true })
    expect(controller.state.status).toBe("incompatible")
  })

  test("reconnecting recovers", async () => {
    const { state, p } = port(snapshot(codex()))
    const controller = new QuotaController(p)
    await controller.start()
    state.snapshotError = new Error("down")
    await controller.sync()
    expect(controller.state.status).toBe("unavailable")
    state.snapshotError = undefined
    state.reconnect!()
    await controller.sync()
    expect(controller.state.status).toBe("ok")
    expect(controller.state.stale).toBe(false)
  })

  test("passive syncs are shared but a manual refresh is never swallowed", async () => {
    const { state, p } = port(snapshot(codex()))
    let release!: () => void
    state.gate = new Promise<void>(resolve => (release = resolve))
    const controller = new QuotaController(p)
    const first = controller.sync()
    const second = controller.sync()
    const manual = controller.sync(true, "openai")
    release()
    await Promise.all([first, second, manual])
    expect(state.snapshots).toBe(1)
    expect(state.refreshes).toEqual(["openai"])
  })

  test("subscribers are notified and can unsubscribe; dispose detaches transport", async () => {
    const { state, p } = port(snapshot(codex()))
    const controller = new QuotaController(p)
    const seen: string[] = []
    const stop = controller.subscribe(s => seen.push(s.status))
    await controller.start()
    stop()
    state.updated!(snapshot(row()))
    expect(seen).toEqual(["ok"])
    controller.dispose()
    expect(state.disposed).toBe(2)
    state.updated!(snapshot(codex(), row(), row()))
    expect(controller.state.snapshot.rows).toHaveLength(1)
  })
})
