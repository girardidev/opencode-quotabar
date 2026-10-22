## Context

This is a greenfield OpenCode V2 subscription quota plugin. The existing Quota Board installation discovers `claude-code` but classifies it as unsupported. OpenChamber 1.5.0 deliberately stores an OAuth-shaped sign-in marker, not a usable Anthropic token; its provider executes through the authenticated local Claude CLI.

Discovery on OpenCode 2.1.3, OpenChamber 1.5.0, Claude CLI 2.1.306, and its installed Agent SDK 0.3.306 successfully executed `initialize` followed by `get_usage` with `skip_behaviors: true`, without sending a user prompt. The response included current five-hour and weekly windows, a dynamic `limits` list, and subscription information. These are observed compatibility points, not guarantees for every version. The OpenChamber `/v1/rate-limit` endpoint returned an old partial observation without utilization and is not sufficient as the primary quota source.

## Goals / Non-Goals

**Goals:**
- Reliably show provider-reported Codex and Claude subscription allowances, their scope, freshness, and reset times.
- Explain every supported integration's inability to return data without disrupting OpenCode sessions.
- Keep credentials server-side and Claude authentication CLI-owned.
- Make experimental protocol and provider schema changes isolated, bounded, and testable.

**Non-Goals:**
- Session cost/token analytics, quota estimates, charts, alerts, automatic switching, or additional providers.
- Editing OpenChamber, reading Claude credential stores, managing login, or renewing Claude tokens ourselves.
- Using browser cookies, scraping terminal output, or silently falling back to model prompts.

## Decisions

### 1. Split server collection from terminal presentation

Use a TypeScript package with server and `./tui` exports, local-directory discovery shims where required, a shared versioned validated RPC contract, and Solid/OpenTUI components using supported slots. Proposed module boundaries are discovery, domain schemas, collectors, Claude transport, scheduler, RPC, formatting, and TUI. Do not copy undocumented host renderable internals.

The server owns HTTP/process operations and publishes credential-free snapshots. The TUI owns presentation and preferences. A details command (provisionally `/quota`) provides per-provider refresh and diagnostics; avoid claiming an existing command silently and document disabling duplicate quota plugins. Prefer package-managed host peer compatibility over bundling a second UI runtime.

Alternative: collect inside the TUI. Rejected because credentials, remote execution, and refresh deduplication belong on the server.

### 2. Discover integrations before attempting collection

Use OpenCode integration/provider APIs to match explicit supported identities: `openai` and OpenChamber's `claude-code`. Create rows for detected supported integrations even without usable connections. Do not equate display names, model names, OAuth-shaped values, and actual credential capabilities. Generic disconnected catalog entries outside these supported identities are out of scope.

Codex requires the active usable OpenAI OAuth connection. Claude requires the detected OpenChamber provider, an active connection marker, and a compatible CLI authenticated to a first-party subscription in the server's execution environment. The marker is not sent anywhere as a bearer token. Capture a private CLI account identity where available, hash it for cache partitioning, and recheck identity before accepting results. If identity continuity cannot be established, do not reuse earlier readings; explain that the source is the server-local CLI account. Raw email/account identifiers must not cross RPC or appear in logs.

Alternative: alias `claude-code` to the Anthropic collector. Rejected because its stored marker cannot authenticate an Anthropic HTTP request.

### 3. Use a minimal Claude control-protocol adapter

Use the configured Claude executable (default `claude` resolved in the server environment) directly with argument arrays, not a shell. Start non-interactive stream-JSON input/output with verbose output and no session persistence. Disable customizations through supported safe-mode controls, disable tools and configured MCP servers, use a neutral trusted working directory, and remove provider/token override variables from the child environment so the CLI uses its own first-party login. Preserve essential platform environment such as PATH and HOME. Do not use `--bare`, which disables OAuth/keychain authentication.

Send only correlated `initialize` and `get_usage` control requests, with `skip_behaviors: true`. Never send a user prompt, resume a conversation, or request a model completion. Parse only expected bounded control responses. Enforce an overall process timeout (default 30 seconds), output size caps, cancellation, and terminate/kill/reap cleanup on every exit path. Sanitize errors rather than forwarding stdout/stderr. Unsupported flags, missing control operations, and changed response shapes become explicit compatibility errors; never retry through `/usage` as an arbitrary model prompt.

Implement this narrow transport behind an interface instead of depending on an experimental SDK method or launching an Agent SDK generation query. Document that the control protocol is experimental. Initial release support targets the verified CLI version and any additional versions covered by compatibility tests, not an assumed semver-wide promise.

Alternative: scrape `/usage` text or extract OAuth tokens. Rejected for fragility and credential ownership. The OpenChamber passive endpoint is deferred; it does not refresh upstream usage, has no account identity in the inspected format, and can combine fields from different observations.

### 4. Keep provider-specific parsing explicit

Codex queries `https://chatgpt.com/backend-api/wham/usage` with the active resolved OAuth credential and account header when available, using bounded HTTP requests and no token logging. Verify the response and preserve independent returned windows. Treat this provider endpoint as an unstable external dependency.

Claude prefers valid server-provided `limits` rows and preserves kind, group, scope, severity, order, active indicator, and reset. Fall back to validated known legacy windows only when the rows are absent/null, not when the server explicitly returns an empty list. Unknown fields are ignored; structurally valid new meter kinds are preserved with safe labels. Null optional model windows are not errors. Missing percentage/reset stays unknown. Invalid rows yield partial diagnostics when other rows are valid, otherwise a response-schema error. Claude report utilization/row percentages are 0–100; passive SDK event utilization is 0–1 and must never share the same conversion implicitly.

Normalize used and remaining percentages, retaining zero as a valid value. Reject invalid/non-finite/out-of-range percentages instead of silently turning them into healthy values. Do not assign fixed durations from labels or imply reset completion before fresh data. Extra usage being disabled is normal metadata, not a collection failure; money amounts are not converted into percentage windows.

### 5. Separate collection state, completeness, and freshness

A snapshot identifies the integration, opaque account partition, collector, source, collection attempt time, last successful observation time, windows, and sanitized diagnostic. Collection state includes loading, ready, disconnected, incompatible authentication, unavailable, and error. Completeness is complete/partial/empty; freshness is fresh/stale/unknown, derived independently. A failed request may coexist with previous stale windows. Snapshot transport carries no credentials or raw upstream payloads.

Errors have stable codes and next actions: missing connection, wrong authentication, missing CLI, CLI signed out/non-subscription account, account mismatch, unsupported CLI/protocol, unauthorized, forbidden, rate-limited, timeout, network failure, invalid response, and service unavailable. Keep HTTP 401 and 403 distinct and show retry timing for throttling.

### 6. Use an account-safe per-location scheduler

Use in-memory snapshots, one in-flight request per location/account/collector, and independent collector execution. Initial defaults: 120-second successful-read TTL, 10-second HTTP timeout, 30-second Claude process timeout, and a two-minute activity lease renewed by TUI subscribers. Validate configuration bounds (TTL 30–3600 seconds; HTTP timeout 1–60 seconds; process timeout 5–60 seconds). Poll only while a client is active; requesting a snapshot renews activity but does not bypass TTL.

Manual refresh bypasses successful-read TTL only. Failed attempts use bounded exponential backoff with jitter (initial 30 seconds, cap 15 minutes), and HTTP Retry-After is a lower bound. A reset deadline can schedule a refresh subject to backoff, but never locally marks a quota replenished. Multiple locations remain isolated in the first version; do not claim server-wide deduplication.

Account changes abort requests and clear old data before new data is exposed. Generation guards discard late replies. CLI identity is verified at refresh boundaries and upon return; snapshots are not persisted across restarts. External CLI account changes cannot be watched reliably, so freshness is explicitly bounded and revalidated before publication. Unload aborts HTTP, kills/reaps children, clears timers, and unregisters events.

### 7. Prefer truthful, compact UI over inferred precision

Show Codex and Claude rows when detected; highlight the session's selected provider without changing accounts/models. Expanded sidebar windows say `left`, include reset countdowns when known, and expose age/stale markers. The collapsed summary uses the provider's active meter when supplied, otherwise the lowest remaining known window with its own reset. Details retain all windows, source, collection status, freshness, error code, next action, and next retry.

Unknown percentages have no fabricated bar. Diagnostics remain reachable by keyboard; status uses text as well as theme color. Narrow layouts truncate labels safely without hiding errors entirely. Persist only presentation preferences; do not persist tokens, raw diagnostics, or quota snapshots. Users may explicitly hide a row, but hidden rows remain visible in the details/manage view and are identified as hidden by preference.

## Risks / Trade-offs

- [Experimental Claude protocol changes] → Version/capability checks, fixture-based control transport tests, a documented compatibility matrix, and explicit unsupported-version errors.
- [CLI processes are heavier than HTTP requests] → Conservative TTL, deduplication, idle pause, bounded process lifetime, no prompt generation.
- [CLI account differs from the account implied by an OpenCode marker] → Treat the marker only as integration enrollment, verify the actual CLI account, label the execution source, invalidate on identity changes, and surface ambiguity instead of assuming equivalence.
- [Remote server has a different or missing CLI login] → Execute collection on that server only and explain its prerequisites; never read credentials from the client machine as an implicit fallback.
- [Provider responses evolve] → Prefer dynamic rows, tolerate additive fields, reject invalid values, and distinguish partial data from schema failure.
- [CLI startup may write operational auth/cache state despite no session persistence] → Do not promise a filesystem-pure subprocess; disable customizations and session persistence, avoid project execution, and document CLI-owned operational state.
- [Duplicated polling across project locations] → Document per-location isolation; global coordination is a later optimization.

## Migration Plan

1. Scaffold and test against the verified OpenCode/Claude versions, then record a tested host compatibility range.
2. Load the package locally with the required server and TUI configuration entries; do not alter user configuration automatically.
3. Smoke-test Codex and Claude against real accounts only with explicit opt-in; do not log or commit raw account payloads. Test remote behavior separately.
4. Publish installation and diagnostics guidance; instruct users to disable the previous quota UI to avoid duplicate panels/commands.
5. Roll back by removing the new plugin entries and restarting/reloading the relevant host. No credential or data migrations are required.

## Open Questions

- Which additional CLI and OpenCode versions pass the compatibility suite? Resolve before publishing a version range.
- Does Claude initialization provide a reliable account identity in every supported environment? If not, report ambiguity and disable cache reuse across unverifiable identity boundaries.
- What is the least disruptive package-prefixed command fallback when another plugin already owns `/quota`? Resolve using documented command registration behavior during implementation.

## References

- OpenCode V2 plugins: https://opencode.ai/v2/docs/build/plugins
- OpenCode CLI plugins: https://opencode.ai/v2/docs/build/plugins/cli
- Claude Agent SDK TypeScript: https://code.claude.com/docs/en/agent-sdk/typescript
- OpenChamber source: https://github.com/openchamber/opencode-claude
- Quota Board reference behavior: https://github.com/gilvex/opencode-quota-board
