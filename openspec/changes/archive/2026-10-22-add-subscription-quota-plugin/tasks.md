## 1. Package and compatibility foundation

- [x] 1.1 Scaffold the TypeScript package, server/TUI exports, local loading shims, strict type checking, and offline test commands without modifying user configuration.
- [x] 1.2 Verify current OpenCode plugin, RPC, integration, and CLI APIs against the installed host; select compatible dependencies/peers and document the initial tested versions.
- [x] 1.3 Define validated plugin options, timeout/output bounds, injectable HTTP/process/clock interfaces, and test fixture sanitization rules.

## 2. Domain model and discovery

- [x] 2.1 Define versioned credential-free quota snapshots, dynamic window metadata, independent collection/completeness/freshness states, and stable diagnostic codes with next actions.
- [x] 2.2 Implement identifier-based discovery for OpenAI and OpenChamber Claude Code, preserving detected rows with absent or incompatible connections.
- [x] 2.3 Implement private account partitioning, connection change detection, and CLI identity verification/ambiguity handling; test that raw identities never reach snapshots.

## 3. Codex collector

- [x] 3.1 Resolve the active OpenAI OAuth connection through OpenCode and reject API keys with an actionable diagnostic before any subscription request.
- [x] 3.2 Add bounded usage HTTP requests with the account header when supplied, cancellation, distinct 401/403/429 handling, and Retry-After parsing.
- [x] 3.3 Normalize independent Codex windows and add fixtures/tests for success, missing windows, zero values, invalid percentages/resets, malformed JSON, network failure, and timeout.

## 4. Claude CLI transport and collector

- [x] 4.1 Resolve/configure the server-local Claude executable, verify supported flags/protocol behavior, and isolate child arguments, environment, working directory, tools, MCP, and customizations.
- [x] 4.2 Implement bounded correlated stream-JSON initialization and `get_usage` control requests with `skip_behaviors: true`, no user messages, and no session persistence.
- [x] 4.3 Implement cancellation, output caps, process error classification, terminate/kill/reap cleanup, and sanitized stdout/stderr handling on every transport path.
- [x] 4.4 Parse dynamic Claude limits and legacy fallback, preserving scope/order/severity/active meter and distinguishing absent/null rows from an explicit empty list.
- [x] 4.5 Handle CLI login/subscription prerequisites, account changes during collection, protocol incompatibility, unavailable rate limits, partial rows, and disabled extra usage.
- [x] 4.6 Add a fake CLI protocol harness covering malformed/fragmented/unrelated responses, missing executable, unsupported operations, hangs, oversized output, identity races, cleanup, and assertions that no user prompt or secret access occurs.

## 5. Refresh lifecycle and RPC

- [x] 5.1 Implement independent per-location/account collectors, in-memory cache, in-flight deduplication, successful-read TTL, and the two-minute activity lease with deterministic clock tests.
- [x] 5.2 Implement exponential jittered failure backoff, Retry-After lower bounds, manual TTL bypass without backoff bypass, and reset-triggered refresh without inferred replenishment.
- [x] 5.3 Preserve stale readings only for verified matching accounts, separate observation/attempt timestamps, and guard late results after invalidation/unload.
- [x] 5.4 Expose validated versioned snapshot/refresh RPC methods and update events without credentials, raw responses, or raw account identifiers.
- [x] 5.5 Test concurrent clients, failure isolation, idle pause/resume, account switching, reconnects, per-location isolation, timeout configuration, and complete lifecycle cleanup.

## 6. Terminal UI and diagnostics

- [x] 6.1 Add semantic-theme sidebar rows with current-provider highlighting, explicit remaining labels, collapse controls, source freshness, unknown-value handling, and reset-pending formatting.
- [x] 6.2 Add a keyboard-accessible details view with all windows, collection/completeness/freshness states, diagnostics, next actions/retry, and per-account/all-account refresh.
- [x] 6.3 Register a documented command with a collision-safe fallback after verifying host behavior; persist presentation preferences only and keep hidden rows accessible in the manage/details view.
- [x] 6.4 Handle unavailable/version-incompatible RPC services and remote CLI prerequisites without attributing transport failure to a provider or exposing client credentials.
- [x] 6.5 Add renderer tests for zero/unknown percentages, partial/stale/error states, active-meter selection, source age, hidden rows, keyboard operation, narrow terminals, and service disconnect/reconnect.

## 7. Release validation and documentation

- [x] 7.1 Add installation/rollback guidance for package and local loading, server versus TUI responsibilities, duplicate quota-plugin removal, configuration defaults, and remote server prerequisites.
- [x] 7.2 Document experimental Claude protocol support, tested compatibility, CLI-owned operational state, account identity limitations, diagnostic actions, and the absence of model-generation polling.
- [x] 7.3 Run offline type checks, collector/transport/lifecycle/RPC tests, UI tests, and credential-leak assertions; verify each spec scenario has coverage.
- [x] 7.4 With explicit user opt-in, smoke-test live Codex and prompt-free Claude refreshes on the verified versions without committing raw payloads; record compatibility and any remote-environment gaps.
- [x] 7.5 Update the project's knowledge graph after code implementation with `graphify update .` as required by repository instructions, then review package contents and validate the OpenSpec change.
