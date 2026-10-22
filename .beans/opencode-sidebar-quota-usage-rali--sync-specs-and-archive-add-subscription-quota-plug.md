---
# opencode-sidebar-quota-usage-rali
title: Sync specs and archive add-subscription-quota-plugin
status: completed
type: task
priority: normal
created_at: 2026-10-22T22:34:05Z
updated_at: 2026-10-22T22:34:14Z
---

Sync the three delta specs into openspec/specs and archive the completed change.

## Todo
- [x] Sync delta specs to main specs
- [x] Archive the change

## Summary of Changes
Ran `openspec archive add-subscription-quota-plugin -y`, which created three main specs under openspec/specs (+18 requirements) and moved the change to openspec/changes/archive/2026-10-22-add-subscription-quota-plugin. All specs validate.
