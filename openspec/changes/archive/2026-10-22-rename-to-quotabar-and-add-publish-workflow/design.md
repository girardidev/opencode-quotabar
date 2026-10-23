## Context

The package is named `opencode-subscription-quota` and has never been published. The git remote already
points at `girardidev/opencode-quotabar`, so the repository was renamed ahead of the code. The old name
appears in `package.json`, `bun.lock`, the README, and as string identifiers in `src/index.ts`
(`.server`), `src/rpc.ts` (`.v1`), `src/tui/index.tsx` (`.tui`, `.open`, `.refresh`, `.toggle`) and the
assertions in `test/tui-plugin.test.tsx`. The existing OpenSpec specs do not mention the name.

There is no `.github/` directory and `package.json` has no `repository` field. The package ships
TypeScript source (`src/`, `index.ts`, `tui.tsx`) with no build step, and tests and development use Bun.

npm Trusted Publishing lets a specific GitHub workflow publish through short-lived OIDC credentials, so
no `NPM_TOKEN` secret exists to leak. It requires npm CLI 11.5.1 or newer, Node 22.14 or newer, a
GitHub-hosted runner, `id-token: write`, and a `repository` URL that matches the publishing repository.
The Trusted Publisher is configured on the package page at npmjs.com, which in practice requires the
package to exist, so the first version is published by hand.

## Goals / Non-Goals

**Goals:**
- One consistent name, `opencode-quotabar`, across package metadata, docs, identifiers and tests.
- A release workflow that publishes with OIDC only, and refuses to publish when the tag, version or
  checks do not line up.
- A documented one-time setup so the maintainer can finish the Trusted Publisher configuration.

**Non-Goals:**
- Publishing the first version (done manually by the maintainer).
- Configuring the Trusted Publisher on npmjs.com (done by the maintainer).
- Adding a build step, bundling, or changing what files ship.
- Changing user-visible product wording, the `/quota` slash command, or any quota behavior.
- Automated version bumping or changelog generation.

## Decisions

**1. Rename identifiers together with the package name.**
All `opencode-subscription-quota.*` identifiers become `opencode-quotabar.*`. The package is
unpublished, so nothing external depends on the old IDs, and a single name avoids a permanent
mismatch between the npm name and the plugin ID. Alternative: keep the old IDs for "stability". Rejected
because there is nothing to stay stable with yet, and changing them after release would be a real break.

**2. Keep user-visible product wording.**
Command titles ("Open subscription quota"), the command group, and the `/quota` slash name describe
what the feature does, not who ships it. Alternative: rebrand to "Quotabar" in the UI. Rejected as scope
creep; it can be a later, separate decision.

**3. Trigger on `release: published`, skip prereleases.**
The job has `if: github.event.release.prerelease == false`. A prerelease would otherwise publish to the
`latest` dist-tag. Alternative: publish prereleases under `--tag next`. Deferred until a prerelease
flow is actually needed.

**4. Verify the tag against `package.json` before publishing.**
A step compares `github.event.release.tag_name` with `v` + the package version and fails on mismatch.
Without it, a release tagged `v0.2.0` over a `package.json` still at `0.1.0` would try to republish an
existing version, or publish a number that does not match the release.

**5. Run the same checks as development before publish.**
Install with `bun install --frozen-lockfile`, then `bun run typecheck` and `bun test`. The tests are
offline, so they need no credentials. A failing check blocks the publish step.

**6. Two toolchains in one job.**
`oven-sh/setup-bun` provides Bun for install, typecheck and tests. `actions/setup-node` provides Node 24
and the npm CLI used by `npm publish`. A guard step upgrades npm when the bundled version is older than
11.5.1. Alternative: publish with Bun. Rejected because Trusted Publishing OIDC support is an npm CLI
feature.

**7. No token anywhere.**
The job sets `permissions: { contents: read, id-token: write }` and never sets `NODE_AUTH_TOKEN`. npm
exchanges the OIDC token for a publish credential and attaches provenance automatically for public
repositories. The package is unscoped, so it is public without extra `access` configuration.

**8. Pin the workflow filename.**
The workflow lives at `.github/workflows/publish.yml`. That exact filename is entered in the npm
Trusted Publisher form, so renaming the file later silently breaks publishing. The README states this.

**9. Add `repository`, `homepage` and `bugs` to `package.json`.**
`repository.url` is `git+https://github.com/girardidev/opencode-quotabar.git`. npm checks it against the
publishing repository, and a missing or different value makes the publish fail.

**10. Gate with `npm pack --dry-run` in the workflow.**
A dry-run before the real publish prints the tarball contents into the log. It catches an accidental
change to `files` and fails early on invalid metadata, before anything is uploaded.

## Risks / Trade-offs

- [The Trusted Publisher cannot be configured until the package exists] → The first publish is manual
  (`npm publish` with the maintainer's 2FA). The README documents the order: rename, manual publish,
  configure the Trusted Publisher, then use the workflow for every later release.
- [Workflow filename or repository case drifts from the npm configuration] → Documented in the README;
  a mismatch fails with an authentication error rather than publishing something wrong.
- [Bundled npm is too old for OIDC] → The guard step upgrades npm and logs the version, so the failure
  is visible instead of a confusing 404 or auth error.
- [Third-party actions are referenced by major tag, not commit SHA] → Accepted for a small project; the
  trade-off is possible tag movement. Pinning to SHAs is a straightforward later hardening.
- [A missed identifier leaves the old name behind] → Tasks include a repository-wide search for the old
  name that must come back empty outside generated or historical files.
- [Releasing a version that was already published] → npm rejects it; the tag/version check surfaces the
  cause earlier and more clearly.

## Migration Plan

1. Land the rename, the metadata fields and the workflow on `main`.
2. Maintainer publishes `0.1.0` manually from a clean checkout (`npm publish`).
3. Maintainer adds the Trusted Publisher on the package page: owner `girardidev`, repository
   `opencode-quotabar`, workflow `publish.yml`, no environment.
4. Optionally, set the package to require 2FA and disallow tokens once OIDC publishing works.
5. For later releases: bump `version`, merge, create a GitHub Release tagged `v<version>`.

Rollback: before the first publish, the rename is an ordinary revert. After publishing, a bad version is
handled with `npm deprecate` or a follow-up patch release; the workflow itself can be disabled in the
repository's Actions settings.

## Open Questions

- Should publishing be gated behind a GitHub Environment with required reviewers? Not included now; it
  would also require setting the environment name in the npm Trusted Publisher form.
- Should prereleases publish under a `next` dist-tag instead of being skipped?
- Should actions be pinned to commit SHAs?
