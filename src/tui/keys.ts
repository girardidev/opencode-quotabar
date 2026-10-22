/** Keyboard commands for the details view. Kept free of the host so they can be tested directly. */
export interface DetailsKeyApi {
  ids(): readonly string[]
  selected(): string | undefined
  select(id: string): void
  refresh(id?: string): void
  toggleHidden(id: string): void
  close(): void
}

export interface KeyCommand {
  bind: string
  title: string
  run(): void
}

export function detailsCommands(api: DetailsKeyApi): KeyCommand[] {
  const move = (delta: number) => () => {
    const ids = api.ids()
    if (!ids.length) return
    const index = Math.max(0, ids.indexOf(api.selected() ?? ""))
    api.select(ids[(index + delta + ids.length) % ids.length]!)
  }
  const onSelected = (act: (id: string) => void) => () => {
    const id = api.selected()
    if (id) act(id)
  }
  return [
    { bind: "escape", title: "Close", run: () => api.close() },
    { bind: "down", title: "Next provider", run: move(1) },
    { bind: "j", title: "Next provider", run: move(1) },
    { bind: "up", title: "Previous provider", run: move(-1) },
    { bind: "k", title: "Previous provider", run: move(-1) },
    { bind: "return", title: "Refresh selected", run: onSelected(id => api.refresh(id)) },
    { bind: "r", title: "Refresh all", run: () => api.refresh() },
    { bind: "h", title: "Hide or show selected in sidebar", run: onSelected(id => api.toggleHidden(id)) },
  ]
}
