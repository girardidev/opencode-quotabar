## 1. Reproduce

- [x] 1.1 Add a test in `test/tui-plugin.test.tsx` where the current model switches from `claude-code` to `anthropic` with a populated snapshot, driven by a signal behind `ctx.ui.model.current()`; confirm it fails with `row.windows` before the fix (the test was added, but it never failed before the fix; the crash could not be reproduced in the test harness or in a standalone TUI)
- [x] 1.2 Add a test where the current provider has no row from the start (`anthropic`) and assert the footer renders nothing without a slot error
- [x] 1.3 If 1.1 does not fail, add a case where `model.current()` is `undefined` at mount and later resolves

## 2. Fix

- [x] 2.1 Rewrite the footer slot in `src/tui/index.tsx` as a keyed `Show` over `currentRow()` with the hidden-preference check inside the render function and no `currentRow()!`
- [x] 2.2 Make `footerText` and `headline` (`src/tui/format.ts`) safe for an undefined row

## 3. Verify

- [x] 3.1 Add a test that a hidden current row renders nothing in the footer, and that a visible row still renders its headline and stale marker
- [x] 3.2 Run the full test suite and typecheck
- [x] 3.3 Run `graphify update .`
- [x] 3.4 Reinstall as a global plugin and confirm no crash with Sonnet 5.5 selected and when switching models (confirmed by the user running the repository build in place of the published plugin)
