/** @jsxImportSource @opentui/solid */
import type { ColorInput } from "@opentui/core"
import { For, Show } from "solid-js"
import type { QuotaRow, QuotaSnapshot, QuotaWindow } from "../domain.ts"
import { CODE_LABEL, formatAge, formatDuration, formatRemaining, formatReset, headline, planText, sourceText, statusText } from "./format.ts"
import { banner, isClosed, isHidden, orderRows, sidebarRows, type Prefs, type ServiceStatus } from "./model.ts"

/** Semantic colors resolved from the host theme. */
export interface Palette {
  base: ColorInput
  muted: ColorInput
  success: ColorInput
  warning: ColorInput
  error: ColorInput
  border: ColorInput
  accent: ColorInput
}

const REMAINING_WARNING = 50
const REMAINING_ERROR = 20

function windowColor(window: QuotaWindow, palette: Palette): ColorInput {
  if (window.severity === "critical") return palette.error
  if (window.severity === "warning") return palette.warning
  if (window.remaining === undefined) return palette.muted
  return window.remaining <= REMAINING_ERROR ? palette.error : window.remaining <= REMAINING_WARNING ? palette.warning : palette.success
}

function rowGlyph(row: QuotaRow, offline: boolean): { glyph: string; color: keyof Palette } {
  if (offline) return { glyph: "◐", color: "warning" }
  switch (row.state) {
    case "ready":
      return row.completeness === "partial" || row.freshness === "stale" ? { glyph: "◐", color: "warning" } : { glyph: "●", color: "success" }
    case "error":
    case "unavailable":
    case "incompatible_auth":
      return { glyph: row.windows.length ? "◐" : "!", color: "error" }
    default:
      return { glyph: "○", color: "muted" }
  }
}

/** Proportional meter that fits any container width. Unknown values render no bar at all. */
function Meter(props: { window: QuotaWindow; palette: Palette }) {
  const filled = () => Math.max(0, Math.min(100, Math.round(props.window.remaining ?? 0)))
  return (
    <Show when={props.window.remaining !== undefined}>
      <box height={1} flexDirection="row">
        <box width={`${filled()}%`} minWidth={0} height={1} overflow="hidden" flexShrink={0}>
          <text width="100%" fg={windowColor(props.window, props.palette)} wrapMode="none">{"━".repeat(240)}</text>
        </box>
        <box width={`${100 - filled()}%`} minWidth={0} height={1} overflow="hidden" flexShrink={0}>
          <text width="100%" fg={props.palette.muted} wrapMode="none">{"─".repeat(240)}</text>
        </box>
      </box>
    </Show>
  )
}

export function WindowBlock(props: { window: QuotaWindow; now: number; palette: Palette; showBar: boolean }) {
  return (
    <box flexDirection="column">
      <box flexDirection="row" justifyContent="space-between" gap={1}>
        <text fg={props.palette.base}>
          {props.window.label}
          <Show when={props.window.active}>
            <span style={{ fg: props.palette.muted }}>{" ★"}</span>
          </Show>
        </text>
        <text fg={windowColor(props.window, props.palette)}>{formatRemaining(props.window)}</text>
      </box>
      <Show when={props.showBar}>
        <Meter window={props.window} palette={props.palette} />
      </Show>
      <text fg={props.palette.muted}>{formatReset(props.window.resetsAt, props.now)}</text>
    </box>
  )
}

/** Bars need room; below this width only text is shown, which carries the same information. */
export function canShowBar(width: number): boolean {
  return width >= 24
}

export interface SidebarProps {
  snapshot: QuotaSnapshot
  status: ServiceStatus
  prefs: Prefs
  currentProviderID?: string
  now: number
  palette: Palette
  width: number
  onToggleCollapsed(): void
  onToggleRow(id: string): void
  onOpenDetails(): void
}

export function SidebarView(props: SidebarProps) {
  const offline = () => props.status === "unavailable" || props.status === "incompatible"
  const rows = () => sidebarRows(props.snapshot, props.prefs, props.currentProviderID)
  const hiddenCount = () => props.snapshot.rows.filter(row => isHidden(props.prefs, row.id)).length
  const message = () => banner(props.status)
  return (
    <box flexDirection="column" marginTop={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={props.palette.base} onMouseDown={() => props.onToggleCollapsed()}>
          <b>{props.prefs.collapsed ? "▸" : "▾"} Subscription quota</b>
        </text>
        <text fg={props.palette.muted} onMouseUp={(event: { stopPropagation(): void }) => (event.stopPropagation(), props.onOpenDetails())}>
          {"details"}
        </text>
      </box>
      <Show when={!props.prefs.collapsed}>
        <Show when={message()}>{text => <text paddingLeft={2} fg={props.palette.warning}>{text()}</text>}</Show>
        <For each={rows()}>
          {row => <SidebarRow row={row} offline={offline()} {...props} current={row.id === props.currentProviderID} />}
        </For>
        <Show when={hiddenCount() > 0}>
          <text paddingLeft={2} fg={props.palette.muted}>{`${hiddenCount()} hidden · open details`}</text>
        </Show>
        <Show when={!props.snapshot.rows.length && !message()}>
          <text paddingLeft={2} fg={props.palette.muted}>{props.status === "connecting" ? "Loading…" : "No Codex or Claude connection found"}</text>
        </Show>
      </Show>
    </box>
  )
}

function SidebarRow(props: SidebarProps & { row: QuotaRow; offline: boolean; current: boolean }) {
  const closed = () => isClosed(props.prefs, props.row.id)
  const glyph = () => rowGlyph(props.row, props.offline)
  const status = () => statusText(props.row, props.offline)
  const top = () => headline(props.row)
  const bars = () => canShowBar(props.width)
  return (
    <box flexDirection="column" paddingLeft={2}>
      <text fg={props.palette.base} onMouseUp={(event: { stopPropagation(): void }) => (event.stopPropagation(), props.onToggleRow(props.row.id))}>
        <span style={{ fg: props.palette[glyph().color] }}>{glyph().glyph}</span>
        {` ${props.row.name}`}
        <Show when={props.current}>
          <span style={{ fg: props.palette.accent }}>{" · current"}</span>
        </Show>
        <span style={{ fg: props.palette.muted }}>{closed() ? " ▸" : " ▾"}</span>
        <Show when={closed()}>
          <span style={{ fg: props.palette.muted }}>
            {top() ? ` ${top()!.label} ${formatRemaining(top()!)}${top()!.resetsAt ? ` · ${formatReset(top()!.resetsAt, props.now, true).replace("resets in ", "")}` : ""}` : status() ? ` ${status()}` : ""}
          </span>
        </Show>
      </text>
      <Show when={!closed()}>
        <box flexDirection="column" paddingLeft={2}>
          <For each={props.row.windows}>
            {window => <WindowBlock window={window} now={props.now} palette={props.palette} showBar={bars()} />}
          </For>
          <Show when={status()}>
            <text fg={props.row.state === "ready" ? props.palette.warning : props.palette.muted}>{status()}</text>
          </Show>
          <Show when={props.row.diagnostic && props.row.state !== "ready"}>
            <text fg={props.palette.muted}>{props.row.diagnostic?.action}</text>
          </Show>
          <Show when={props.row.observedAt !== undefined && (props.row.freshness === "stale" || props.offline)}>
            <text fg={props.palette.muted}>{formatAge(props.row.observedAt, props.now)}</text>
          </Show>
        </box>
      </Show>
    </box>
  )
}

export interface DetailsProps {
  snapshot: QuotaSnapshot
  status: ServiceStatus
  prefs: Prefs
  selectedId?: string
  currentProviderID?: string
  now: number
  palette: Palette
  width: number
  onSelect(id: string): void
  onRefresh(id?: string): void
  onToggleHidden(id: string): void
  onClose(): void
}

export function DetailsView(props: DetailsProps) {
  const rows = () => orderRows(props.snapshot.rows, props.currentProviderID)
  const offline = () => props.status === "unavailable" || props.status === "incompatible"
  const message = () => banner(props.status)
  const bars = () => canShowBar(props.width)
  return (
    <box flexDirection="column" paddingX={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={props.palette.base}><b>Subscription quota</b></text>
        <text fg={props.palette.muted} onMouseUp={() => props.onClose()}>{"esc ×"}</text>
      </box>
      <text fg={props.palette.muted}>{props.snapshot.refreshing ? "Refreshing…" : "Provider-reported allowances, shown as remaining."}</text>
      <Show when={message()}>{text => <text fg={props.palette.warning}>{text()}</text>}</Show>
      <For each={rows()}>
        {row => {
          const selected = () => row.id === props.selectedId
          return (
            <box
              flexDirection="column"
              border
              borderStyle="rounded"
              borderColor={selected() ? props.palette.accent : props.palette.border}
              paddingX={1}
              flexShrink={0}
              onMouseUp={() => props.onSelect(row.id)}
            >
              <box flexDirection="row" justifyContent="space-between" gap={1}>
                <text fg={props.palette.base}>
                  <b>{`${selected() ? "▸ " : ""}${row.name}`}</b>
                  <Show when={planText(row)}>
                    <span style={{ fg: props.palette.muted }}>{` · ${planText(row)}`}</span>
                  </Show>
                </text>
                <text fg={props.palette.accent}>{row.id === props.currentProviderID ? "CURRENT" : ""}</text>
              </box>
              <text fg={props.palette.muted}>{sourceText(row)}</text>
              <text fg={row.state === "ready" && row.freshness === "fresh" && row.completeness !== "partial" ? props.palette.success : props.palette.warning}>
                {stateLine(row, offline())}
              </text>
              <box flexDirection="column" marginTop={1} gap={1}>
                <For each={row.windows}>
                  {window => <WindowBlock window={window} now={props.now} palette={props.palette} showBar={bars()} />}
                </For>
                <Show when={row.windows.length === 0 && row.state !== "loading"}>
                  <text fg={props.palette.muted}>No usage windows returned.</text>
                </Show>
              </box>
              <Show when={row.diagnostic}>
                {diagnostic => (
                  <box flexDirection="column" marginTop={1}>
                    <text fg={diagnostic().code === "partial_data" || diagnostic().code === "identity_unverified" ? props.palette.warning : props.palette.error}>
                      {`${CODE_LABEL[diagnostic().code]} [${diagnostic().code}]`}
                    </text>
                    <text fg={props.palette.base}>{diagnostic().message}</text>
                    <text fg={props.palette.muted}>{`Next: ${diagnostic().action}`}</text>
                    <Show when={diagnostic().retryAt !== undefined && diagnostic().retryAt! > props.now}>
                      <text fg={props.palette.muted}>{`Next retry in ${formatDuration(diagnostic().retryAt! - props.now)}`}</text>
                    </Show>
                  </box>
                )}
              </Show>
              <text fg={props.palette.muted} marginTop={1}>
                {`${formatAge(row.observedAt, props.now)}${row.cliVersion ? ` · CLI ${row.cliVersion}` : ""}${row.extraUsageEnabled === false ? " · extra usage off" : ""}`}
              </text>
              <box flexDirection="row" gap={2} flexWrap="wrap">
                <text fg={props.palette.muted} onMouseUp={(event: { stopPropagation(): void }) => (event.stopPropagation(), props.onRefresh(row.id))}>{"↻ refresh"}</text>
                <text fg={isHidden(props.prefs, row.id) ? props.palette.warning : props.palette.muted} onMouseUp={(event: { stopPropagation(): void }) => (event.stopPropagation(), props.onToggleHidden(row.id))}>
                  {isHidden(props.prefs, row.id) ? "○ hidden from sidebar · show" : "● shown in sidebar · hide"}
                </text>
              </box>
            </box>
          )
        }}
      </For>
      <Show when={!rows().length}>
        <text fg={props.palette.muted}>{message() ? "No readings available yet." : "No Codex or Claude connection found. Connect one in OpenCode."}</text>
      </Show>
      <text fg={props.palette.muted} wrapMode="word">{"↑/↓ select · enter refresh selected · r refresh all · h hide/show · esc close"}</text>
    </box>
  )
}

/** Collection state, completeness and freshness are reported separately, as words. */
export function stateLine(row: QuotaRow, offline: boolean): string {
  const state = offline ? "service offline" : statusText(row) || "ready"
  const base = row.state === "ready" && !offline ? "ready" : state
  // While the service is offline the readings are old no matter what the last snapshot said.
  return `${base} · ${row.completeness} · ${offline ? "stale" : row.freshness}`
}
