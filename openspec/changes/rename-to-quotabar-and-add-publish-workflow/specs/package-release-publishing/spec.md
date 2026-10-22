## ADDED Requirements

### Requirement: Consistent package identity
The package SHALL be named `opencode-quotabar`, and every plugin, command and RPC identifier derived
from the package name SHALL use the `opencode-quotabar` prefix. No source, test or documentation file
SHALL reference the previous name `opencode-subscription-quota`, except historical records.

#### Scenario: Package metadata
- **WHEN** `package.json` is read
- **THEN** its `name` is `opencode-quotabar`

#### Scenario: Plugin identifiers
- **WHEN** the server plugin, the terminal plugin, its commands and its RPC channel are registered
- **THEN** each identifier starts with `opencode-quotabar` and none starts with `opencode-subscription-quota`

#### Scenario: Leftover references
- **WHEN** the repository is searched for `opencode-subscription-quota`, excluding generated graph output and bean history
- **THEN** no match is found

### Requirement: User-visible wording is unchanged
The rename SHALL NOT change user-visible text or the slash command: command titles, the command group,
the sidebar copy and the default `/quota` slash name SHALL remain as before.

#### Scenario: Command presentation
- **WHEN** the terminal plugin registers its commands after the rename
- **THEN** the titles, group and slash names are identical to those before the rename

### Requirement: Publishable repository metadata
`package.json` SHALL declare `repository`, `homepage` and `bugs` pointing at
`github.com/girardidev/opencode-quotabar`, and the `repository.url` SHALL match the repository that runs
the publish workflow.

#### Scenario: Repository field
- **WHEN** `package.json` is read
- **THEN** `repository.url` is `git+https://github.com/girardidev/opencode-quotabar.git`

### Requirement: Release-triggered publishing
A workflow at `.github/workflows/publish.yml` SHALL publish the package to npm when a GitHub Release is
published, and SHALL NOT run for prereleases or for any other event.

#### Scenario: Stable release
- **WHEN** a non-prerelease GitHub Release is published
- **THEN** the workflow runs the publish job

#### Scenario: Prerelease
- **WHEN** a GitHub Release marked as prerelease is published
- **THEN** no publish occurs

### Requirement: Tokenless Trusted Publishing
The publish job SHALL authenticate to npm only through OIDC Trusted Publishing: it SHALL request
`id-token: write` with otherwise read-only permissions, SHALL use an npm CLI of at least 11.5.1 on Node
22.14 or newer, and SHALL NOT read or require any long-lived npm token secret.

#### Scenario: Permissions
- **WHEN** the workflow file is inspected
- **THEN** the publish job grants `id-token: write` and `contents: read` and references no `NPM_TOKEN` or `NODE_AUTH_TOKEN` secret

#### Scenario: Old npm CLI
- **WHEN** the runner's npm CLI is older than 11.5.1
- **THEN** the workflow upgrades it before publishing and logs the resulting version

### Requirement: Publish guards
The workflow SHALL fail before publishing when the release tag is not `v` followed by the
`package.json` version, when installation with the frozen lockfile fails, when typecheck fails, or when
any test fails.

#### Scenario: Tag mismatch
- **WHEN** a release is tagged `v0.2.0` while `package.json` has version `0.1.0`
- **THEN** the workflow fails and does not run `npm publish`

#### Scenario: Failing tests
- **WHEN** a test fails during the workflow
- **THEN** the workflow fails and does not run `npm publish`

#### Scenario: Matching release
- **WHEN** the tag is `v0.2.0`, `package.json` has version `0.2.0`, and all checks pass
- **THEN** the workflow runs `npm publish`

### Requirement: Documented release procedure
The README SHALL document the one-time setup (manual first publish, then Trusted Publisher
configuration with owner, repository and the exact workflow filename `publish.yml`) and the steps to
cut a release.

#### Scenario: Maintainer follows the README
- **WHEN** a maintainer reads the release section of the README
- **THEN** it lists the manual first publish, the Trusted Publisher fields to enter on npmjs.com, and the version-bump-then-release steps
