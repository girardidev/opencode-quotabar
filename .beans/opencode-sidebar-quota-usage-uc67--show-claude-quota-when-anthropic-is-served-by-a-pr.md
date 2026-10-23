---
# opencode-sidebar-quota-usage-uc67
title: Show Claude quota when Anthropic is served by a proxy plugin
status: completed
type: bug
priority: normal
created_at: 2026-10-23T10:29:46Z
updated_at: 2026-10-23T10:35:24Z
---

After replacing @openchamber/opencode-claude with opencode-with-claude (Meridian proxy), the Claude quota row disappeared: discovery only detects the 'claude-code' integration and collection requires an active connection.

## Summary of Changes

The Claude row now appears when Anthropic is served by any plugin (for example opencode-with-claude), not only through the OpenChamber claude-code integration.

- `src/discovery.ts`: the Claude row is enrolled by the claude-code integration or provider, or by the anthropic provider. The anthropic integration alone is ignored because integration.list enumerates every known integration. `Detected` gains `connectionRequired` (true for openai, false for Claude).
- `src/service.ts`: a `connectable` helper replaces the three checks on detected.connection, so the Claude row collects and is never reported as disconnected for lack of a connection. OpenAI is unchanged.
- `src/index.ts`, `src/collectors/claude/collector.ts`: the Claude collector is built without a connection; connectionKey is optional and the partition falls back to the verified CLI identity.
- Tests: discovery, service, server-plugin and Claude collector cover the anthropic-only host, merge with claude-code, connection-free collection, missing CLI and identity cases. 176 tests pass and tsc is clean.
- Verified against the real host and CLI: the Claude row was detected with no connection and returned Session and Weekly windows.
- Spike result recorded in the change design: integration.list has 235 entries, provider.list has 3 (anthropic included), and anthropic has no connections.
