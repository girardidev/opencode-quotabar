## Why

The package is still named `opencode-subscription-quota`, which is long and is not the name chosen for
publishing. It is about to go to npm for the first time, so the rename is free now and would be
breaking after release. There is also no automated way to publish: releases should come from a GitHub
Release through npm Trusted Publishing (OIDC), with no long-lived `NPM_TOKEN` secret.

## What Changes

- Rename the package from `opencode-subscription-quota` to `opencode-quotabar` everywhere it appears:
  `package.json` `name`, `bun.lock`, README title and install snippets, and the plugin, command and RPC
  identifiers (`opencode-quotabar.server`, `.tui`, `.open`, `.refresh`, `.toggle`, `.v1`).
- Update the tests that assert those identifiers.
- Add the `repository`, `homepage` and `bugs` fields to `package.json`, pointing at
  `girardidev/opencode-quotabar`. Trusted Publishing validates the repository URL.
- Add `.github/workflows/publish.yml`: on a published, non-prerelease GitHub Release, verify the tag
  matches `package.json` `version`, run typecheck and tests, and run `npm publish` using OIDC.
- Document the one-time setup and the release procedure in the README (Trusted Publisher
  configuration on npmjs.com, manual first publish, how to cut a release).
- Keep user-visible product wording unchanged: command titles ("Open subscription quota"), the
  `/quota` slash command and the sidebar copy do not change.
- **BREAKING** (only for anyone running the unpublished build): plugin, command and RPC identifiers
  change. The package has never been published, so there are no known external users.

## Capabilities

### New Capabilities
- `package-release-publishing`: how the package is named, what metadata it carries, and how a GitHub
  Release is turned into an npm publish through Trusted Publishing, including the guards that stop a
  mismatched or unsafe publish.

### Modified Capabilities

None. The existing quota collection, refresh and visibility specs do not mention the package name or
identifiers, so no requirement in them changes.

## Impact

- Code: `package.json`, `bun.lock`, `README.md`, `src/index.ts`, `src/rpc.ts`, `src/tui/index.tsx`,
  `test/tui-plugin.test.tsx`.
- New file: `.github/workflows/publish.yml`.
- Generated or historical files that mention the old name (`graphify-out/`, `.beans/` history) are not
  edited by hand; `graphify update .` refreshes the graph.
- External systems: an npm account and the package page on npmjs.com (Trusted Publisher
  configuration, done by the maintainer after the first manual publish); GitHub Actions on the
  `girardidev/opencode-quotabar` repository.
- Dependencies: none added to the package. The workflow uses `actions/checkout`, `actions/setup-node`
  and `oven-sh/setup-bun`.
