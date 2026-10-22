## Why

Connected AI subscriptions can disappear from existing quota panels without an actionable explanation. In particular, Claude accessed through OpenChamber is a CLI-managed subscription, not an Anthropic OAuth token managed by OpenCode; discovery confirmed that its current quota can be obtained through the Claude CLI control protocol without sending a model prompt or extracting credentials.

## What Changes

- Introduce an OpenCode V2 plugin with server-side collectors and a terminal sidebar plus an on-demand details panel.
- Support the active OpenAI Codex OAuth connection and the `claude-code` integration supplied by OpenChamber.
- Query Claude subscription usage through a bounded, prompt-free Claude CLI control process, with transcript behavior analysis disabled and experimental protocol compatibility checks.
- Normalize provider-reported windows, remaining percentages, reset times, provenance, observation age, and partial results without estimating subscription quotas from session tokens.
- Keep detected supported integrations visible when disconnected, incompatible, loading, or failing; provide sanitized diagnostics and a next action rather than silently hiding them.
- Add independent refresh, caching, request deduplication, backoff, cancellation, account invalidation, and a versioned RPC contract.
- Document local and remote installation, required connection types, Claude CLI prerequisites, and experimental compatibility limits.

## Capabilities

### New Capabilities

- `subscription-quota-collection`: Discover supported integrations and collect account-scoped Codex and Claude subscription windows without exposing credentials or invoking model generation.
- `quota-refresh-lifecycle`: Coordinate bounded refreshes, freshness, failure isolation, retries, cancellation, and account-safe cache invalidation.
- `quota-visibility-and-diagnostics`: Display consistent subscription summaries and details, with explicit partial, stale, unavailable, and actionable error states.

### Modified Capabilities

None. This is a new plugin with no existing baseline capabilities.

## Impact

- Adds TypeScript server, shared protocol, adapter, test, and TUI modules; package exports support published and local-directory loading.
- Depends on OpenCode V2 plugin/RPC/TUI APIs and host-compatible OpenTUI/Solid peers. The implementation must verify supported versions instead of assuming all V2 releases expose the same surface.
- Uses OpenCode connection resolution for Codex and the existing authenticated Claude CLI for OpenChamber. Claude authentication remains CLI-owned; no credential migration, direct token extraction, or custom login is introduced.
- Contacts the Codex usage service and allows the Claude CLI to retrieve subscription usage. The plugin must not issue model-generation requests for polling.
- Initial scope excludes historical charts, notifications, automatic account/model switching, billing estimates, additional providers, and modification of OpenChamber or user configuration without explicit user action.
