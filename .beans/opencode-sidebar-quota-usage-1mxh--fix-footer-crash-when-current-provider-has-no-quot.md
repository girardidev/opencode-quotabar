---
# opencode-sidebar-quota-usage-1mxh
title: Fix footer crash when current provider has no quota row
status: in-progress
type: bug
created_at: 2026-10-22T23:29:18Z
updated_at: 2026-10-22T23:29:18Z
---

Implements OpenSpec change fix-footer-crash-without-current-row. Footer slot dereferences an undefined row (row.windows) for providers without a quota row.
