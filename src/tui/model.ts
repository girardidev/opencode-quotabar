import type { QuotaRow, QuotaSnapshot } from "../domain.ts"

/** Presentation preferences only; never credentials, diagnostics or readings. */
export interface Prefs {
  /** Row ids hidden from the sidebar by the user. */
  hidden: string[]
  /** Row ids collapsed to a one-line summary. */
  closed: string[]
  collapsed: boolean
}

export const DEFAULT_PREFS: Prefs = { hidden: [], closed: [], collapsed: false }

export type ServiceStatus = "connecting" | "ok" | "unavailable" | "incompatible"

/** Current provider first, then the server's order. */
export function orderRows(rows: readonly QuotaRow[], currentProviderID: string | undefined): QuotaRow[] {
  const rank = (row: QuotaRow) => (row.id === currentProviderID ? 0 : 1)
  return rows.map((row, index) => ({ row, index })).sort((a, b) => rank(a.row) - rank(b.row) || a.index - b.index).map(entry => entry.row)
}

export const isHidden = (prefs: Prefs, id: string) => (prefs.hidden ?? []).includes(id)
export const isClosed = (prefs: Prefs, id: string) => (prefs.closed ?? []).includes(id)

/** Hidden rows leave the sidebar but never the manage view. */
export function sidebarRows(snapshot: QuotaSnapshot, prefs: Prefs, current: string | undefined): QuotaRow[] {
  return orderRows(snapshot.rows, current).filter(row => !isHidden(prefs, row.id))
}

export function banner(status: ServiceStatus): string | undefined {
  if (status === "unavailable") return "Quota service unavailable. Enable the server plugin and run `opencode reload`."
  if (status === "incompatible") return "Quota service version mismatch. Update both halves of the plugin."
  return undefined
}

/** Picks a slash name that no other command already claims. */
export function chooseSlashName(
  commands: ReadonlyArray<{ slash?: { name: string; aliases?: readonly string[] } }>,
  preferred = "quota",
  fallback = "subscription-quota",
): string {
  const taken = new Set(commands.flatMap(command => (command.slash ? [command.slash.name, ...(command.slash.aliases ?? [])] : [])))
  return taken.has(preferred) ? fallback : preferred
}

/** Toggle membership immutably. */
export function toggle(values: readonly string[] | undefined, id: string): string[] {
  const list = values ?? []
  return list.includes(id) ? list.filter(value => value !== id) : [...list, id]
}
