## Why

Claude quota only appears when OpenCode exposes the OpenChamber `claude-code` integration. Users who serve Anthropic models through another plugin, such as `opencode-with-claude` (Meridian proxy), lose the Claude row even though the server-local Claude CLI is signed in and can report the same limits. The row disappears because discovery and collection are both gated on a plugin-specific integration and an active OpenCode connection, neither of which the Claude CLI collector actually needs.

## What Changes

- Detect the Claude collector from the `anthropic` provider in addition to the OpenChamber `claude-code` integration or provider, so the row appears however Anthropic models are served.
- Stop requiring an OpenCode connection to collect Claude usage: the Claude CLI owns authentication, so the connection is not a prerequisite. A missing or signed-out CLI still produces an actionable diagnostic row.
- Derive the Claude account boundary from the CLI account identity alone when no OpenCode connection exists, keeping readings isolated per verified account.
- Keep `claude-code` working unchanged for existing OpenChamber users; both ids resolve to the same single Claude row.
- Reverse the current guarantee that `anthropic` is ignored by discovery, scoped to the Claude row only. Other providers are still not auto-detected.

Out of scope: a provider registry or auto-registration of arbitrary providers, declarative provider definitions, balance-style quotas, and any new provider besides Claude.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `subscription-quota-collection`: "Supported integration discovery" now also detects the Claude row from the `anthropic` provider and no longer requires an OpenCode connection for it; "Account-bound collection" defines the Claude partition when no connection exists.

## Impact

- `src/discovery.ts`: detection rules for the Claude row, connection becomes optional for it.
- `src/service.ts`: due-ness and start logic no longer treat a missing connection as disconnected for connection-free collectors.
- `src/index.ts`: collector factory builds the Claude collector without a connection, with a fixed key.
- `src/collectors/claude/collector.ts`: partition derived from CLI identity when no connection key is given.
- `test/discovery.test.ts`, `test/service.test.ts`, `test/server-plugin.test.ts`: update the "explicit identifiers only" expectation and add connection-free cases.
- No new dependencies, no change to the RPC snapshot schema, no change to the CLI invocation or its isolation guarantees.
