## Context

The Claude row exists only when OpenCode reports the OpenChamber `claude-code` integration or provider (`src/discovery.ts`). The row then needs an active OpenCode connection twice: the collector factory throws `not_connected` without one (`src/index.ts`), and the scheduler never starts a collection or reports anything but "disconnected" without one (`src/service.ts`, `isDue`, `start`, `row`).

That coupling is incidental. The Claude collector does not read the connection: authentication belongs to the server-local Claude CLI, and the connection key is only mixed into the account partition. A user who replaced the OpenChamber plugin with `opencode-with-claude` (a Meridian proxy that configures the built-in `anthropic` provider with a placeholder key) therefore loses the row, although the CLI is signed in.

Existing tests pin that `anthropic` is ignored by discovery ("by explicit identifiers only"). That guarantee existed to stop arbitrary providers or display names from enrolling a collector; it is not a requirement that Anthropic specifically must be ignored.

## Goals / Non-Goals

**Goals:**
- Show the Claude row for users whose Anthropic models are served by any plugin, with no extra configuration.
- Keep the OpenChamber `claude-code` setup working with no behavior change.
- Keep one Claude row, one collector and the existing RPC snapshot schema.

**Non-Goals:**
- A provider registry or auto-detection of other providers.
- Declarative provider definitions, balance-style quotas, or any new collector.
- Changing the CLI invocation, isolation flags or credential handling.

## Decisions

**1. Detect Claude from `claude-code` (integration or provider) or from the `anthropic` provider.**
`discover` keeps an explicit identifier match, now a small alias table for the Claude row: `claude-code` and `anthropic` resolve to the internal id `claude-code`. `claude-code` keeps today's rule (integration or provider). `anthropic` is matched against `providers` only: the spike showed `integration.list()` enumerates every integration OpenCode knows (hundreds, `anthropic` included, regardless of use), whereas `provider.list()` holds the providers actually in use. Matching `anthropic` as an integration would show the row to every user. Matching stays by id and `integrationID`, never by display name. Other providers such as `openrouter` remain undetected.
Alternative: detect by the proxy plugin or a loopback `baseURL`. Rejected as brittle and specific to one plugin.
Alternative: a user option to enable the row. Rejected for now because it breaks the zero-config goal; it can be added later without conflict.

**2. Keep the internal id `claude-code`.**
The id is part of the RPC schema (`INTEGRATIONS`, `refresh` input) and of the partition key. Renaming would change the snapshot contract for no user benefit. The alias only affects detection.

**3. Make the connection optional per integration, not globally.**
`Detected` gains `connectionRequired: boolean`: `true` for `openai`, `false` for the Claude row. The scheduler treats a row with `connectionRequired: false` as connectable: it can be due, can start, and does not render "disconnected" only because the host reported no connection. OpenAI behavior is unchanged.
Alternative: synthesize a fake connection for Claude. Rejected because it invents state and would leak into change detection.

**4. Fixed collector key when there is no connection.**
`ClaudeDeps.connectionKey` becomes optional. When present (OpenChamber), it is mixed into the partition exactly as today. When absent, the partition depends only on the verified CLI identity (email, organization, plan), which already isolates accounts. A row that moves between "with connection" and "without" resets through the existing `connectionKey` change detection.

**5. Prefer the `claude-code` connection when both ids are present.**
Users with OpenChamber also have the `anthropic` provider. Detection merges both into one `Detected` and uses the `claude-code` connection if the host provides one.

**6. Surface a missing CLI as a normal diagnostic.**
Anyone with the `anthropic` provider now gets a Claude row, including API-key users with no CLI. The existing diagnostics (`cli_missing`, `cli_signed_out`) already explain the server-side prerequisite and are subject to the usual failure backoff, so no new state is added.

## Risks / Trade-offs

- [Host might not list `anthropic` as a provider when only a placeholder key is configured] → Resolved by the spike: it does (see Open Questions).
- [Every user with the `anthropic` provider gets a Claude row, including API-key users without the CLI] → The row shows a clear prerequisite diagnostic and backs off after failures. If this proves noisy, hide the row on `cli_missing` when it was detected only through `anthropic`.
- [Reversing "anthropic is ignored" could enroll unintended providers] → Matching stays on exact ids; a test keeps `openrouter` and display-name matches undetected.
- [Partition changes for users who move from OpenChamber to a proxy plugin] → Readings are in-memory only and are rebuilt on the next collection, so there is nothing to migrate.

## Open Questions

Resolved by the spike, run against OpenCode v2.1.3 with `opencode-with-claude` and `@openchamber/opencode-claude` disabled (`opencode api GET /api/integration`, `/api/provider`, `/api/integration/{id}`):

- `integration.list()` returned 235 entries, including `anthropic` and `openai`, and no `claude-code`. It lists every known integration, not only used ones.
- `provider.list()` returned 3 entries: `opencode`, `openai` and `anthropic` (with `integrationID: "anthropic"`).
- `GET /api/integration/anthropic` returned `connections: []`, while `openai` had one OAuth credential connection. The placeholder key in `opencode.json` is therefore not an OpenCode connection, which is why collection must not require one.
