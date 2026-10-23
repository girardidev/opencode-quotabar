---
# opencode-sidebar-quota-usage-1mxh
title: Fix footer crash when current provider has no quota row
status: completed
type: bug
priority: normal
created_at: 2026-10-22T23:29:18Z
updated_at: 2026-10-23T02:29:01Z
---

Implements OpenSpec change fix-footer-crash-without-current-row. Footer slot dereferences an undefined row (row.windows) for providers without a quota row.



## Summary of Changes

- Footer slot now renders through a keyed `Show`, so its child receives the row instead of re-reading `currentRow()!`; the hidden-row check moved inside.
- `footerText` and `headline` accept an undefined row (and a row without `windows`).
- Added footer tests: provider without a row, model switch, row vanishing from a snapshot (alone and batched), missing model at mount, hidden row.
- The crash was never reproduced in tests or in a standalone TUI, and the Sonnet 5.5 provider turned out to be `claude-code` (it has a row), so the exact trigger is unknown. The reporter confirmed the fix by running the repository build in place of the published plugin.
- Needs a release: the global plugin still loads the published 0.1.0 until a new version is published.
