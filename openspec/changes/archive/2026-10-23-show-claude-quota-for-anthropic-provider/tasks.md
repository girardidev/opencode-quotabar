## 1. Spike: what the host reports

- [x] 1.1 Query the host for the integration list, the provider list and the `anthropic` connections in the `opencode-with-claude` setup and record the result in this change's design Open Questions
- [x] 1.2 Revise the detection decision where the spike contradicts it: `anthropic` is matched against `providers` only, since `integration.list()` enumerates every known integration

## 2. Discovery

- [x] 2.1 Add `connectionRequired` to `Detected` in `src/discovery.ts` (`true` for `openai`, `false` for the Claude row)
- [x] 2.2 Resolve `claude-code` (integration or provider) and `anthropic` (provider only), by id or `integrationID`, to one Claude entry, using the `claude-code` connection when available
- [x] 2.3 Keep `openrouter` and display-name matches undetected
- [x] 2.4 Update `test/discovery.test.ts`: anthropic provider now detected, anthropic integration alone ignored, merged with `claude-code`, still ignoring unrelated ids and display names

## 3. Scheduler

- [x] 3.1 In `src/service.ts`, stop treating a missing connection as disconnected or not-due when `connectionRequired` is false (`isDue`, `start`, `row`)
- [x] 3.2 Keep OpenAI behavior unchanged and cover both cases in `test/service.test.ts`
- [x] 3.3 Verify an entry resets when it moves between with-connection and without-connection

## 4. Collector wiring

- [x] 4.1 Make `ClaudeDeps.connectionKey` optional in `src/collectors/claude/collector.ts` and derive the partition from CLI identity alone when absent
- [x] 4.2 In `src/index.ts`, build the Claude collector without a connection while OpenAI still throws `not_connected`
- [x] 4.3 Add tests in `test/server-plugin.test.ts` and the Claude collector tests for the connection-free path, a missing CLI and an unverifiable identity

## 5. Verify

- [x] 5.1 Run the full test suite and type check
- [x] 5.2 Run the plugin against the real `opencode-with-claude` setup and confirm the Claude row shows limits
- [x] 5.3 Run `graphify update .` and update the bean `opencode-sidebar-quota-usage-uc67` with a Summary of Changes
