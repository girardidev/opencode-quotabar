## Why

Installed as a global OpenCode plugin, the TUI crashed on startup: `opencode-quotabar.tui crashed in slot prompt.footer.status: undefined is not an object (evaluating 'row.windows')`. The footer slot assumes the current model's provider always has a quota row, but only `openai` and `claude-code` do. With any other provider (the reporter had Sonnet 5.5 selected) or when the model changes after mount, `currentRow()` becomes `undefined` and the footer still dereferences it. Tests never cover this because they pin `providerID: "claude-code"`.

## What Changes

- Render the footer through a keyed `Show` so the child receives the narrowed row instead of re-reading `currentRow()!`.
- Make `footerText` and `headline` safe when given no row, as a second line of defense.
- Show nothing in the footer when the current provider has no quota row or its row is hidden.
- Add regression tests: provider without a row, and switching the current model from a provider with a row to one without, with a populated snapshot.

## Capabilities

### New Capabilities

### Modified Capabilities
- `quota-visibility-and-diagnostics`: adds a requirement that the prompt footer status never fails for providers without a quota row and renders only for the current provider's visible row.

## Impact

- `src/tui/index.tsx` (footer slot, `footerText`)
- `src/tui/format.ts` (`headline` tolerance)
- `test/tui-plugin.test.tsx` (new regression cases)
- No API, dependency, or storage changes.
