## 1. Rename package and identifiers

- [x] 1.1 Set `name` to `opencode-quotabar` in `package.json` and regenerate the `bun.lock` workspace name (`bun install`)
- [x] 1.2 Replace the `opencode-subscription-quota` identifiers with `opencode-quotabar` in `src/index.ts`, `src/rpc.ts` and `src/tui/index.tsx` (`.server`, `.v1`, `.tui`, `.open`, `.refresh`, `.toggle`)
- [x] 1.3 Update the identifier assertions in `test/tui-plugin.test.tsx`
- [x] 1.4 Update the README title, the `plugins` snippets and the `"package"` entry to `opencode-quotabar`
- [x] 1.5 Confirm command titles, group names and the `/quota` slash name are untouched
- [x] 1.6 Search the repo for `opencode-subscription-quota`; only `graphify-out/` and `.beans/` history may still match

## 2. Package metadata

- [x] 2.1 Add `repository` (`git+https://github.com/girardidev/opencode-quotabar.git`), `homepage` and `bugs` to `package.json`
- [x] 2.2 Run `npm pack --dry-run` and check that the tarball lists only `src/`, `index.ts`, `tui.tsx`, `README.md` and `package.json`

## 3. Publish workflow

- [x] 3.1 Create `.github/workflows/publish.yml` triggered by `release: types: [published]`, with the job guarded by `github.event.release.prerelease == false`
- [x] 3.2 Set job permissions to `contents: read` and `id-token: write`, with no npm token secret and no `NODE_AUTH_TOKEN`
- [x] 3.3 Add checkout, `oven-sh/setup-bun` and `actions/setup-node` (Node 24, `registry-url: https://registry.npmjs.org`) steps
- [x] 3.4 Add a step that upgrades npm when its version is below 11.5.1 and logs the Node and npm versions
- [x] 3.5 Add a step that fails when `github.event.release.tag_name` is not `v` plus the `package.json` version
- [x] 3.6 Add `bun install --frozen-lockfile`, `bun run typecheck` and `bun test` steps ahead of publishing
- [x] 3.7 Add an `npm pack --dry-run` step, then `npm publish` as the final step
- [x] 3.8 Validate the workflow syntax locally (for example with `actionlint`, if available) and re-read it against the spec scenarios

## 4. Documentation

- [x] 4.1 Add a "Releasing" section to the README: manual first publish, Trusted Publisher fields (owner `girardidev`, repository `opencode-quotabar`, workflow `publish.yml`, no environment), and the bump-version-then-create-release steps
- [x] 4.2 Note in the README that renaming `publish.yml` requires updating the Trusted Publisher entry on npmjs.com

## 5. Verification

- [x] 5.1 Run `bun run typecheck` and `bun test`; both pass
- [x] 5.2 Run `graphify update .` so the knowledge graph reflects the new name
- [x] 5.3 Walk through each scenario in `specs/package-release-publishing/spec.md` and confirm it is satisfied
