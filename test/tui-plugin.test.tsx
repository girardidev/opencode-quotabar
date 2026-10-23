/** @jsxImportSource @opentui/solid */
import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { batch, createSignal } from "solid-js"
import { createStore, produce } from "solid-js/store"
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

function fakeCtx(options: { takenSlash?: string; snapshotValue?: unknown; failing?: boolean; providerID?: string | undefined; preferences?: object; saveFailure?: boolean } = {}) {
  // Reactive like the real host: the footer must follow model changes after mount.
  const [providerID, setProviderID] = createSignal<string | undefined>("providerID" in options ? options.providerID : "claude-code")
  const calls = { snapshot: [] as unknown[], refresh: [] as unknown[], disposed: [] as string[], layers: [] as Array<() => any>, toasts: [] as unknown[], saved: 0 }
  const slots: Slot[] = []
  let updated: ((event: any) => void) | undefined
  let reconnect: (() => void) | undefined
  const [prefs, setPrefs] = createStore<any>({})
  let dialog: (() => any) | undefined
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
        setPrefs(structuredClone(options.preferences ?? opt.initial))
        return [prefs, async (mutate: (draft: any) => void) => {
          if (options.saveFailure) throw new Error("storage unavailable")
          setPrefs(produce(mutate))
          calls.saved++
        }]
      },
    },
    ui: {
      slot: (claim: Slot) => (slots.push(claim), () => void calls.disposed.push(claim.append!)),
      model: { current: () => (providerID() ? { providerID: providerID()!, modelID: "x" } : undefined) },
      dialog: { set: () => {}, show: (node: () => any) => { dialog = node }, clear: () => { dialog = undefined } },
      toast: { show: (toast: unknown) => void calls.toasts.push(toast) },
    },
    keymap: {
      layer: (factory: () => any) => void calls.layers.push(factory),
      commands: () => (options.takenSlash ? [{ slash: { name: options.takenSlash } }] : []),
    },
  }
  return { ctx, calls, slots, prefs, setPrefs, get dialog() { return dialog }, location, setProviderID, emitUpdate: (data: unknown, directory = "/work") => updated?.({ data, location: { directory } }), reconnect: () => reconnect?.() }
}

const open: Array<{ dispose(): Promise<void> }> = []
afterEach(async () => {
  for (const setup of open.splice(0)) await setup.dispose().catch(() => {})
})
const commands = (calls: ReturnType<typeof fakeCtx>["calls"]) => calls.layers.flatMap(layer => layer().commands as any[])
const settle = () => new Promise(resolve => setTimeout(resolve, 20))

describe("tui plugin", () => {
  test("display mode updates both surfaces without refreshing, persists, and leaves the footer remaining", async () => {
    const host = fakeCtx({ preferences: { hidden: [], closed: [], collapsed: false } })
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    const sidebar = await testRender(() => host.slots[0]!.render() as any, { width: 38, height: 30 })
    open.push(sidebar)
    commands(host.calls).find(c => c.id === "opencode-quotabar.open").run()
    const details = await testRender(() => host.dialog!(), { width: 90, height: 90 })
    open.push(details)
    await settle()
    await sidebar.renderOnce()
    await details.renderOnce()
    expect(sidebar.captureCharFrame()).toContain("84%")
    expect(details.captureCharFrame()).toContain("Display: Remaining")
    const snapshots = host.calls.snapshot.length
    const refreshes = host.calls.refresh.length
    commands(host.calls).findLast(c => c.bind === "u").run()
    await sidebar.renderOnce()
    await details.renderOnce()
    expect(sidebar.captureCharFrame()).toContain("16%")
    expect(details.captureCharFrame()).toContain("Display: Used")
    expect(details.captureCharFrame()).toContain("shown as used.")
    expect(details.captureCharFrame()).toContain("22%")
    expect(host.calls.snapshot).toHaveLength(snapshots)
    expect(host.calls.refresh).toHaveLength(refreshes)
    expect(host.prefs.displayMode).toBe("used")

    const footer = await testRender(() => host.slots[1]!.render() as any, { width: 60, height: 3 })
    open.push(footer)
    await footer.renderOnce()
    expect(footer.captureCharFrame()).toContain("Weekly 78% left")

    commands(host.calls).findLast(c => c.bind === "escape").run()
    await details.dispose()
    commands(host.calls).find(c => c.id === "opencode-quotabar.open").run()
    const reopened = await testRender(() => host.dialog!(), { width: 90, height: 90 })
    open.push(reopened)
    await reopened.renderOnce()
    expect(reopened.captureCharFrame()).toContain("Display: Used")
    const preferences = JSON.parse(JSON.stringify(host.prefs))
    cleanup()

    const restarted = fakeCtx({ preferences })
    const stop = (await plugin.setup(restarted.ctx)) as () => void
    await settle()
    const restored = await testRender(() => restarted.slots[0]!.render() as any, { width: 38, height: 30 })
    open.push(restored)
    await restored.renderOnce()
    expect(restored.captureCharFrame()).toContain("16%")
    expect(restarted.prefs.displayMode).toBe("used")
    stop()
  })

  test("clicking the mode control works without providers and preserves legacy preferences", async () => {
    const legacy = { hidden: ["openai"], closed: ["claude-code"], collapsed: true, displayMode: "invalid" }
    const host = fakeCtx({ preferences: legacy, snapshotValue: snapshot() })
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    commands(host.calls).find(c => c.id === "opencode-quotabar.open").run()
    const setup = await testRender(() => host.dialog!(), { width: 80, height: 30 })
    open.push(setup)
    await settle()
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Display: Remaining")
    const lines = setup.captureCharFrame().split("\n")
    const y = lines.findIndex(line => line.includes("Display: Remaining"))
    await setup.mockMouse.click(lines[y]!.indexOf("Display:") + 1, y)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Display: Used")
    expect(host.prefs).toEqual({ ...legacy, displayMode: "used" })
    commands(host.calls).findLast(c => c.bind === "u").run()
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Display: Remaining")
    cleanup()
  })

  test("failed display preference saves use the existing error feedback", async () => {
    const host = fakeCtx({ saveFailure: true })
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    commands(host.calls).find(c => c.id === "opencode-quotabar.open").run()
    const setup = await testRender(() => host.dialog!(), { width: 80, height: 30 })
    open.push(setup)
    commands(host.calls).findLast(c => c.bind === "u").run()
    await settle()
    expect(host.calls.toasts).toEqual([{ message: "Could not save quota preferences", variant: "error" }])
    expect(host.prefs.displayMode).toBe("remaining")
    cleanup()
  })

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

  test("the footer renders nothing when the current provider has no quota row", async () => {
    const host = fakeCtx({ providerID: "anthropic" })
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    const setup = await testRender(() => host.slots[1]!.render() as any, { width: 60, height: 3 })
    open.push(setup)
    await setup.renderOnce()
    expect(setup.captureCharFrame().trim()).toBe("")
    cleanup()
  })

  test("the footer disappears without error when the model changes to a provider without a row", async () => {
    const host = fakeCtx()
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    const setup = await testRender(() => host.slots[1]!.render() as any, { width: 60, height: 3 })
    open.push(setup)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Claude · Weekly 78% left")
    host.setProviderID("anthropic")
    await setup.renderOnce()
    expect(setup.captureCharFrame().trim()).toBe("")
    host.setProviderID("claude-code")
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Claude · Weekly 78% left")
    cleanup()
  })

  test("the footer survives its row vanishing from a new snapshot, alone or batched with a model change", async () => {
    const host = fakeCtx()
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    const setup = await testRender(() => host.slots[1]!.render() as any, { width: 60, height: 3 })
    open.push(setup)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Claude · Weekly 78% left")
    host.emitUpdate(snapshot(codex()))
    await setup.renderOnce()
    expect(setup.captureCharFrame().trim()).toBe("")
    host.emitUpdate(snapshot(codex(), row()))
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Claude · Weekly 78% left")
    batch(() => {
      host.setProviderID("anthropic")
      host.emitUpdate(snapshot())
    })
    await setup.renderOnce()
    expect(setup.captureCharFrame().trim()).toBe("")
    cleanup()
  })

  test("the footer copes with no current model at mount and with a model that resolves later", async () => {
    const host = fakeCtx({ providerID: undefined })
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    const setup = await testRender(() => host.slots[1]!.render() as any, { width: 60, height: 3 })
    open.push(setup)
    await setup.renderOnce()
    expect(setup.captureCharFrame().trim()).toBe("")
    host.setProviderID("claude-code")
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Claude · Weekly 78% left")
    cleanup()
  })

  test("the footer stays empty when the current provider's row is hidden", async () => {
    const host = fakeCtx()
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    host.setPrefs("hidden", ["claude-code"])
    await settle()
    const setup = await testRender(() => host.slots[1]!.render() as any, { width: 60, height: 3 })
    open.push(setup)
    await setup.renderOnce()
    expect(setup.captureCharFrame().trim()).toBe("")
    cleanup()
  })

  test("claims /quota when free, and falls back when another plugin owns it", async () => {
    const free = fakeCtx()
    const cleanupFree = (await plugin.setup(free.ctx)) as () => void
    expect(commands(free.calls).find(c => c.id === "opencode-quotabar.open").slash.name).toBe("quota")
    cleanupFree()
    const taken = fakeCtx({ takenSlash: "quota" })
    const cleanupTaken = (await plugin.setup(taken.ctx)) as () => void
    expect(commands(taken.calls).find(c => c.id === "opencode-quotabar.open").slash.name).toBe("subscription-quota")
    cleanupTaken()
  })

  test("palette commands refresh via the server and toggle presentation only", async () => {
    const host = fakeCtx()
    const cleanup = (await plugin.setup(host.ctx)) as () => void
    await settle()
    const all = commands(host.calls)
    all.find(c => c.id === "opencode-quotabar.refresh").run()
    await settle()
    expect(host.calls.refresh).toHaveLength(1)
    all.find(c => c.id === "opencode-quotabar.toggle").run()
    expect(host.prefs.collapsed).toBe(true)
    expect(Object.keys(host.prefs).sort()).toEqual(["closed", "collapsed", "displayMode", "hidden"])
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
