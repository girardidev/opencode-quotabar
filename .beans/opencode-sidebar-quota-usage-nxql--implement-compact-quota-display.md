---
# opencode-sidebar-quota-usage-nxql
title: Implement compact quota display
status: completed
type: feature
priority: normal
created_at: 2026-10-23T13:53:28Z
updated_at: 2026-10-23T14:03:15Z
---

Implement OpenSpec compact-quota-display. Track detailed implementation progress in the change tasks.md; preserve unrelated work.

## Progress

Implemented mode-aware preferences and formatting, compact window blocks, shared mode controls, and regression tests. Focused tests and typecheck pass. Full suite passed with the temporary visual inspection test (189 tests); finishing cleanup, final verification, and graph refresh.

## Summary of Changes

Implemented all 13 tasks in compact-quota-display: compact label/reset/value rows with meters beneath, persisted global Remaining/Used preference for sidebar and details, clickable and keyboard-accessible mode control, legacy preference fallback, mode-aware collapsed summaries, and unchanged exhaustion colors/footer semantics. Added formatting, layout, color, state, persistence, interaction, and save-error regression coverage; updated README. Verified representative headless terminal frames at 38/22-column sidebar and 80/30-column details widths. Final checks: 188 tests passed, typecheck passed, strict OpenSpec validation passed, design detector returned no findings, and graphify update . completed. No commit or push performed.
