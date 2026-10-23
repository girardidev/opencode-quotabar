/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { useTerminalDimensions } from "@opentui/solid"
import { createSignal, Show } from "solid-js"
import type { QuotaRow, SupportedIntegration } from "../domain.ts"
import { QuotaRpc } from "../rpc.ts"
import { QuotaController, type ControllerState, type QuotaPort } from "./controller.ts"
import { formatRemaining, headline } from "./format.ts"
import { detailsCommands } from "./keys.ts"
import { chooseSlashName, DEFAULT_PREFS, displayMode, isHidden, orderRows, toggle, type Prefs } from "./model.ts"
import { DetailsView, SidebarView, type Palette } from "./views.tsx"

const SYNC_MS = 30_000
const CLOCK_MS = 15_000
const SIDEBAR_WIDTH = 38

export default Plugin.define({
  id: "opencode-quotabar.tui",
  setup(ctx) {
    const rpc = ctx.client.rpc(QuotaRpc)
    const location = () => ctx.location ?? ctx.data.location.default()
    const port: QuotaPort = {
      snapshot: () => rpc.snapshot({}, { location: location() }),
      refresh: integrationID => rpc.refresh({ integrationID }, { location: location() }),
      onUpdated: listener => rpc.events.on("updated", event => (event.location.directory === location()?.directory ? listener(event.data) : undefined)),
      onReconnect: listener => ctx.data.on("server.connected", () => listener()),
    }
    const controller = new QuotaController(port)
    const [state, setState] = createSignal<ControllerState>(controller.state)
    const [now, setNow] = createSignal(Date.now())
    const stopState = controller.subscribe(setState)
    const [prefs, updatePrefs] = ctx.storage.store<Prefs>("preferences", { initial: DEFAULT_PREFS })
    const save = (mutation: (draft: Prefs) => void) =>
      void updatePrefs(mutation).catch(() => ctx.ui.toast.show({ message: "Could not save quota preferences", variant: "error" }))
    const toggleDisplayMode = () => save(draft => void (draft.displayMode = displayMode(draft) === "remaining" ? "used" : "remaining"))

    const palette = (theme: typeof ctx.theme = ctx.theme): Palette => ({
      base: theme.text.base,
      muted: theme.text.muted,
      success: theme.text.feedback.success.base,
      warning: theme.text.feedback.warning.base,
      error: theme.text.feedback.error.base,
      border: theme.border.base,
      accent: theme.text.feedback.success.base,
    })
    const current = () => ctx.ui.model.current()?.providerID
    const currentRow = (): QuotaRow | undefined => state().snapshot.rows.find(row => row.id === current())

    void controller.start()
    const clock = setInterval(() => setNow(Date.now()), CLOCK_MS)
    const poll = setInterval(() => void controller.sync(), SYNC_MS)

    function Details() {
      const dimensions = useTerminalDimensions()
      const rows = () => orderRows(state().snapshot.rows, current())
      const [selected, setSelected] = createSignal<string | undefined>(current())
      const effective = () => (rows().some(row => row.id === selected()) ? selected() : rows()[0]?.id)
      const commands = detailsCommands({
        ids: () => rows().map(row => row.id),
        selected: effective,
        select: id => setSelected(id),
        refresh: id => void controller.sync(true, id as SupportedIntegration | undefined),
        toggleHidden: id => save(draft => void (draft.hidden = toggle(draft.hidden, id))),
        toggleDisplayMode,
        close: () => ctx.ui.dialog.clear(),
      })
      ctx.keymap.layer(() => ({ mode: "global", commands: commands.map(({ bind, title, run }) => ({ bind, title, run })) }))
      const dialog = palette(ctx.theme.surface("dialog"))
      return (
        <scrollbox height={Math.max(8, dimensions().height - 8)}>
          <DetailsView
            snapshot={state().snapshot}
            status={state().status}
            prefs={prefs}
            selectedId={effective()}
            currentProviderID={current()}
            now={now()}
            palette={dialog}
            width={Math.min(dimensions().width - 8, 100)}
            onSelect={setSelected}
            onRefresh={id => void controller.sync(true, id as SupportedIntegration | undefined)}
            onToggleHidden={id => save(draft => void (draft.hidden = toggle(draft.hidden, id)))}
            onToggleDisplayMode={toggleDisplayMode}
            onClose={() => ctx.ui.dialog.clear()}
          />
        </scrollbox>
      )
    }

    function open() {
      ctx.ui.dialog.set({ size: "large", centered: true })
      ctx.ui.dialog.show(Details)
      void controller.sync()
    }

    // `/quota` is shared with other quota plugins; claim it only if it is free.
    const slash = chooseSlashName(ctx.keymap.commands())
    ctx.keymap.layer(() => ({
      mode: "global",
      commands: [
        { id: "opencode-quotabar.open", title: "Open subscription quota", group: "Subscription quota", palette: true, slash: { name: slash }, run: open },
        { id: "opencode-quotabar.refresh", title: "Refresh subscription quota", group: "Subscription quota", palette: true, run: () => void controller.sync(true) },
        {
          id: "opencode-quotabar.toggle",
          title: "Collapse or expand subscription quota in the sidebar",
          group: "Subscription quota",
          palette: true,
          run: () => save(draft => void (draft.collapsed = !draft.collapsed)),
        },
      ],
    }))

    const stopSidebar = ctx.ui.slot({
      append: "sidebar.content",
      render: () => (
        <SidebarView
          snapshot={state().snapshot}
          status={state().status}
          prefs={prefs}
          currentProviderID={current()}
          now={now()}
          palette={palette()}
          width={SIDEBAR_WIDTH}
          onToggleCollapsed={() => save(draft => void (draft.collapsed = !draft.collapsed))}
          onToggleRow={id => save(draft => void (draft.closed = toggle(draft.closed, id)))}
          onOpenDetails={open}
        />
      ),
    })
    const stopFooter = ctx.ui.slot({
      append: "prompt.footer.status",
      render: () => (
        // Keyed: the child receives the row itself, so it can never re-read a row that has since vanished.
        <Show when={currentRow()} keyed>
          {row => (
            <Show when={!isHidden(prefs, row.id)}>
              <text fg={ctx.theme.text.muted} onMouseUp={(event: { stopPropagation(): void }) => (event.stopPropagation(), open())}>
                {footerText(row, state().status !== "ok")}
              </text>
            </Show>
          )}
        </Show>
      ),
    })

    return () => {
      clearInterval(clock)
      clearInterval(poll)
      stopState()
      controller.dispose()
      stopSidebar()
      stopFooter()
    }
  },
})

function footerText(row: QuotaRow | undefined, offline: boolean): string {
  if (!row) return ""
  const top = headline(row)
  const value = top ? `${top.label} ${formatRemaining(top)}` : row.state === "loading" ? "loading…" : "unavailable"
  return `${row.name} · ${value}${offline || row.freshness === "stale" ? " · stale" : ""}`
}
