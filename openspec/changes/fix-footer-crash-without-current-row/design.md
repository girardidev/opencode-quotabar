## Context

The footer slot (`src/tui/index.tsx`, `prompt.footer.status`) renders the current model's quota row:

```tsx
<Show when={currentRow() && !isHidden(prefs, currentRow()!.id)}>
  <text>{footerText(currentRow()!, ...)}</text>
</Show>
```

`currentRow()` is `undefined` for any provider other than `openai` and `claude-code`, and it can flip from defined to `undefined` when the host restores or changes the model after the plugin mounts. A non-keyed `Show` does not guarantee that its children stop reevaluating before the condition change propagates, so the `!` assertion can run with `undefined` and `headline(row)` throws on `row.windows`. The sidebar and details view iterate real rows with `For`, so they are not affected.

Existing tests pin `providerID: "claude-code"`, so the provider-without-row path is untested.

## Goals / Non-Goals

**Goals:**
- The footer never throws, whatever the current provider is and however it changes.
- Footer output is unchanged when the current provider has a visible row.
- Regression tests for both "no row" and "row disappears".

**Non-Goals:**
- Adding quota rows for more providers (for example plain `anthropic`).
- Changing the sidebar or details view.
- Changing footer wording or styling.

## Decisions

**Keyed render function instead of `!` assertions.** Use `<Show when={currentRow()}>{row => ...}</Show>` and apply the hidden check inside, so the child only sees the row it was created for. Alternative: keep the non-keyed `Show` and replace `!` with optional chaining. Rejected because it hides the problem and leaves the same fragile structure.

**Defensive guards in `footerText` and `headline`.** Accept `QuotaRow | undefined` and return an empty string or `undefined` when there is no row. This is a second line of defense for any future caller. The cost is a slightly wider signature.

**Reproduce first.** Write the failing test (switch `model.current()` from `claude-code` to `anthropic` with a populated snapshot) before the fix. The root cause is not yet confirmed: with a provider that never has a row the `Show` child never runs, so the crash needs a transition. If the test does not fail, the second mechanism (model unavailable at mount) gets its own case.

## Risks / Trade-offs

- [The fake host in tests may not reproduce Solid's reevaluation order] → Drive the model change through a signal read by `ctx.ui.model.current()`, as the real host does, and confirm the test fails before the fix.
- [Keyed `Show` recreates the text node when the row object identity changes on every snapshot] → Rows are replaced per snapshot at a low rate (poll interval); the cost is negligible.

## Open Questions

- What `providerID` does the host report for Sonnet 5.5 in the reporter's setup? Confirms which path triggered the crash.
