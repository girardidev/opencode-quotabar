/** @jsxImportSource @opentui/solid */
import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import plugin from "../src/tui/index.tsx"
import { QuotaRpc } from "../src/rpc.ts"
import { codex, row, snapshot } from "./tui-helpers.ts"

const theme = {
  text: { base: "#ffffff", muted: "#888888", feedback: { success: { base: "#00ff00" }, warning: { base: "#ffaa00" }, error: { base: "#ff0000" } } },
  border: { base: "#444444" },
  surface: () => theme,
}

interface Slot {
  append?: string
  render: () => unknown
}

function fakeCtx(options: { takenSlash?: string; snapshotValue?: unknown; failing?: boolean } = {}) {
  const calls = { snapshot: [] as unknown[], refresh: [] as unknown[], disposed: [] as string[], layers: [] as Array<() => any>, saved: 0 }
  const slots: Slot[] = []
  let updated: ((event: any) => void) | undefined
  let reconnect: (() => void) | undefined
  const prefs: any = { hidden: [], closed: [], collapsed: false }
  const rpc = {
    snapshot: async (input: unknown, opts: unknown) => {
      calls.snapshot.push({ input, opts })
      if (options.failing) throw new Error("rpc.unavailable")
      return options.snapshotValue ?? snapshot(codex(), row())
    },
    refresh: async (input: unknown, opts: unknown) => {
      calls.refresh.push({ input, opts })
      return options.snapshotValue ?? snapshot(codex(), row())
    },
    events: { on: (_name: string, handler: (event: any) => void) => ((updated = handler), () => void calls.disposed.push("updated")) },
  }
  const location = { directory: "/work" }
  const ctx: any = {
    location,
    theme,
    client: { rpc: (definition: unknown) => (expect(definition).toBe(QuotaRpc), rpc) },
    data: {
      location: { default: () => location },
      on: (_type: string, handler: () => void) => ((reconnect = handler), () => void calls.disposed.push("reconnect")),
    },
    storage: {
      store: (_key: string, opt: { initial: object }) => {
        Object.assign(prefs, structuredClone(opt.initial))
        return [prefs, async (mutate: (draft: any) => void) => (mutate(prefs), void calls.saved++)]
      },
    },
    ui: {
      slot: (claim: Slot) => (slots.push(claim), () => void calls.disposed.push(claim.append!)),
      model: { current: () => ({ providerID: "claude-code", modelID: "x" }) },
      dialog: { set: () => {}, show: () => {}, clear: () => {} },
      toast: { show: () => {} },
    },
    keymap: {
      layer: (factory: () => any) => void calls.layers.push(factory),
      commands: () => (options.takenSlash ? [{ slash: { name: options.takenSlash } }] : []),
    },
  }
  return { ctx, calls, slots, prefs, location, emitUpdate: (data: unknown, directory = "/work") => updated?.({ data, location: { directory } }), reconnect: () => reconnect?.() }
}

const open: Array<{ dispose(): Promise<void> }> = []
afterEach(async () => {
  for (const setup of open.splice(0)) await setup.dispose().catch(() => {})
})
const commands = (calls: ReturnType<typeof fakeCtx>["calls"]) => calls.layers.flatMap(layer => layer().commands as any[])
const settle = () => new Promise(resolve => setTimeout(resolve, 20))

describe("tui plugin", () => {
  test("registers sidebar and footer slots and fetches the snapshot for its own location", async () => {
    const host = fakeCtx()
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    expect(host.slots.map(s => s.append)).toEqual(["sidebar.content", "prompt.footer.status"])
    expect(host.calls.snapshot).toHaveLength(1)
    expect((host.calls.snapshot[0] as any).opts).toEqual({ location: host.location })
    cleanup()
  })

  test("the sidebar slot renders live rows, and updates for other locations are ignored", async () => {
    const host = fakeCtx({ snapshotValue: snapshot(codex()) })
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    const setup = await testRender(() => host.slots[0]!.render() as any, { width: 44, height: 30 })
    open.push(setup)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Codex")
    expect(setup.captureCharFrame()).not.toContain("Claude")
    host.emitUpdate(snapshot(codex(), row()), "/elsewhere")
    await setup.renderOnce()
    expect(setup.captureCharFrame()).not.toContain("Claude")
    host.emitUpdate(snapshot(codex(), row()))
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Claude")
    cleanup()
  })

  test("the footer shows the current provider's headline meter", async () => {
    const host = fakeCtx()
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    const setup = await testRender(() => host.slots[1]!.render() as any, { width: 60, height: 3 })
    open.push(setup)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Claude · Weekly 78% left")
    cleanup()
  })

  test("claims /quota when free, and falls back when another plugin owns it", async () => {
    const free = fakeCtx()
    const cleanupFree = (await plugin.setup(free.ctx)) as () => void
    expect(commands(free.calls).find(c => c.id === "opencode-subscription-quota.open").slash.name).toBe("quota")
    cleanupFree()
    const taken = fakeCtx({ takenSlash: "quota" })
    const cleanupTaken = (await plugin.setup(taken.ctx)) as () => void
    expect(commands(taken.calls).find(c => c.id === "opencode-subscription-quota.open").slash.name).toBe("subscription-quota")
    cleanupTaken()
  })

  test("palette commands refresh via the server and toggle presentation only", async () => {
    const host = fakeCtx()
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    const all = commands(host.calls)
    all.find(c => c.id === "opencode-subscription-quota.refresh").run()
    await settle()
    expect(host.calls.refresh).toHaveLength(1)
    all.find(c => c.id === "opencode-subscription-quota.toggle").run()
    expect(host.prefs.collapsed).toBe(true)
    expect(Object.keys(host.prefs).sort()).toEqual(["closed", "collapsed", "hidden"])
    cleanup()
  })

  test("service outage is reflected without throwing, then recovers on reconnect", async () => {
    const host = fakeCtx({ failing: true })
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    const setup = await testRender(() => host.slots[0]!.render() as any, { width: 50, height: 20 })
    open.push(setup)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Quota service unavailable")
    host.emitUpdate(snapshot(codex()))
    await setup.renderOnce()
    expect(setup.captureCharFrame()).not.toContain("Quota service unavailable")
    expect(setup.captureCharFrame()).toContain("Codex")
    cleanup()
  })

  test("cleanup releases slots, transport listeners and timers", async () => {
    const host = fakeCtx()
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    cleanup()
    expect(host.calls.disposed.sort()).toEqual(["reconnect", "sidebar.content", "prompt.footer.status", "updated"].sort())
    const before = host.calls.snapshot.length
    host.reconnect()
    host.emitUpdate(snapshot(codex()))
    await settle()
    expect(host.calls.snapshot.length).toBe(before)
  })
})
