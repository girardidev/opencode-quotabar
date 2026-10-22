---
# opencode-sidebar-quota-usage-w4jz
title: Rename to opencode-quotabar and add npm publish workflow
status: completed
type: task
priority: normal
created_at: 2026-10-22T22:44:52Z
updated_at: 2026-10-22T22:45:27Z
---

Implements OpenSpec change rename-to-quotabar-and-add-publish-workflow. Rename package and identifiers, add repository metadata, add Trusted Publishing workflow, document release procedure.

- [x] Rename package and identifiers
- [x] Package metadata
- [x] Publish workflow
- [x] Documentation
- [x] Verification


## Summary of Changes

- Renamed package and all plugin, command and RPC identifiers to `opencode-quotabar` (package.json, bun.lock, src, tests, README).
- Added `repository`, `homepage`, `bugs` to package.json.
- Added `.github/workflows/publish.yml` (release-triggered, OIDC Trusted Publishing, tag/version guard, typecheck, tests, `npm pack --dry-run`, `npm publish`).
- Added a Releasing section to the README.
- Verified: typecheck clean, 159 tests pass, `npm pack --dry-run` lists 25 expected files, workflow YAML parses. actionlint was not installed, so no lint beyond parsing.
