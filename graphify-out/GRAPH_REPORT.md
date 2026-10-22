# Graph Report - opencode-sidebar-quota-usage  (2026-10-22)

## Corpus Check
- 61 files · ~33,803 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .lock 1, .toml 1)

## Summary
- 516 nodes · 1089 edges · 27 communities (20 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- views.tsx
- transport.ts
- service.ts
- codex.ts
- package.json
- QuotaService
- ADDED Requirements
- src/index.ts
- ADDED Requirements
- QuotaController
- opencode-subscription-quota
- ADDED Requirements
- Decisions
- compilerOptions
- detailsCommands
- openspec-explore/SKILL.md
- opsx-explore.md
- tasks.md
- proposal.md
- fake-claude.ts
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `QuotaService` - 28 edges
2. `QuotaSnapshot` - 21 edges
3. `CollectError` - 20 edges
4. `DetailsView()` - 19 edges
5. `SupportedIntegration` - 14 edges
6. `setup()` - 14 edges
7. `QuotaController` - 13 edges
8. `isRecord()` - 12 edges
9. `QuotaWindow` - 12 edges
10. `SidebarRow()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `fail()` --calls--> `CollectError`  [EXTRACTED]
  test/service-harness.ts → src/diagnostics.ts
- `Fake` --references--> `QuotaSnapshot`  [EXTRACTED]
  test/server-plugin.test.ts → src/domain.ts
- `DetailsOpts` --references--> `QuotaSnapshot`  [EXTRACTED]
  test/tui-render.test.tsx → src/domain.ts
- `SidebarOpts` --references--> `QuotaSnapshot`  [EXTRACTED]
  test/tui-render.test.tsx → src/domain.ts
- `TestClock` --implements--> `Clock`  [EXTRACTED]
  test/helpers.ts → src/options.ts

## Import Cycles
- None detected.

## Communities (27 total, 7 thin omitted)

### Community 0 - "views.tsx"
Cohesion: 0.07
Nodes (56): @opentui/solid, QuotaRow, CODE_LABEL, formatAge(), formatDuration(), formatPercent(), formatRemaining(), formatReset() (+48 more)

### Community 1 - "transport.ts"
Cohesion: 0.06
Nodes (30): ClaudeDeps, createClaudeCollector(), identity(), abortError(), buildChildEnv(), CLAUDE_ARGS, ClaudeAccount, RawClaudeUsage (+22 more)

### Community 2 - "service.ts"
Cohesion: 0.08
Nodes (31): zod, ParsedClaudeUsage, Collection, Collector, Source, connectionKey(), Detected, discover() (+23 more)

### Community 3 - "codex.ts"
Cohesion: 0.10
Nodes (37): classifyControlError(), classifyStderr(), humanize(), LEGACY, parseClaudeUsage(), parseLegacy(), parseLimits(), parseReset() (+29 more)

### Community 4 - "package.json"
Cohesion: 0.05
Nodes (37): dependencies, @opencode/client, @opencode/plugin, zod, description, devDependencies, @opencode/theme, @opentui/core (+29 more)

### Community 5 - "QuotaService"
Cohesion: 0.15
Nodes (7): describe(), diagnose(), QuotaSnapshot, setup(), Clock, QuotaService, ServiceDeps

### Community 6 - "ADDED Requirements"
Cohesion: 0.08
Nodes (24): ADDED Requirements, Requirement: Account-bound collection, Requirement: Bounded and isolated CLI execution, Requirement: Codex subscription collection, Requirement: Credential-free snapshots, Requirement: Dynamic and partial quota normalization, Requirement: Prompt-free Claude usage collection, Requirement: Supported integration discovery (+16 more)

### Community 7 - "src/index.ts"
Cohesion: 0.12
Nodes (15): @opencode/plugin, CodexCredential, hostCodexCredential(), HostContext, hostDiscovery(), RawConnection, resolve(), Registered (+7 more)

### Community 8 - "ADDED Requirements"
Cohesion: 0.11
Nodes (17): ADDED Requirements, Requirement: Account invalidation and cleanup, Requirement: Activity-aware scheduling, Requirement: Backoff-aware manual refresh, Requirement: Freshness independent of attempt status, Requirement: Independent bounded refresh, Requirement: Reset requires confirmation, Scenario: Concurrent clients (+9 more)

### Community 9 - "QuotaController"
Cohesion: 0.17
Nodes (5): EMPTY_SNAPSHOT, snapshotSchema, ControllerState, QuotaController, QuotaPort

### Community 10 - "opencode-subscription-quota"
Cohesion: 0.12
Nodes (16): Claude: how it works, and its limits, Codex, Development, Diagnostics, From a local checkout, From a package, Install, opencode-subscription-quota (+8 more)

### Community 11 - "ADDED Requirements"
Cohesion: 0.12
Nodes (15): ADDED Requirements, Requirement: Accessible presentation preferences, Requirement: Actionable sanitized diagnostics, Requirement: Explicit unavailable and stale states, Requirement: Local and remote execution guidance, Requirement: Subscription sidebar and details, Scenario: Authorization failures differ, Scenario: Claude cannot be queried (+7 more)

### Community 12 - "Decisions"
Cohesion: 0.13
Nodes (14): 1. Split server collection from terminal presentation, 2. Discover integrations before attempting collection, 3. Use a minimal Claude control-protocol adapter, 4. Keep provider-specific parsing explicit, 5. Separate collection state, completeness, and freshness, 6. Use an account-safe per-location scheduler, 7. Prefer truthful, compact UI over inferred precision, Context (+6 more)

### Community 13 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, jsx, jsxImportSource, module, moduleResolution, noEmit, noUncheckedIndexedAccess (+5 more)

### Community 14 - "detailsCommands"
Cohesion: 0.26
Nodes (4): detailsCommands(), DetailsKeyApi, KeyCommand, api()

### Community 15 - "openspec-explore/SKILL.md"
Cohesion: 0.18
Nodes (10): Check for context, Ending Discovery, Guardrails, Handling Different Entry Points, OpenSpec Awareness, The Stance, What You Don't Have To Do, What You Might Do (+2 more)

### Community 16 - "opsx-explore.md"
Cohesion: 0.20
Nodes (9): Check for context, Ending Discovery, Guardrails, OpenSpec Awareness, The Stance, What You Don't Have To Do, What You Might Do, When a change exists (+1 more)

### Community 17 - "tasks.md"
Cohesion: 0.25
Nodes (7): 1. Package and compatibility foundation, 2. Domain model and discovery, 3. Codex collector, 4. Claude CLI transport and collector, 5. Refresh lifecycle and RPC, 6. Terminal UI and diagnostics, 7. Release validation and documentation

### Community 18 - "proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 19 - "fake-claude.ts"
Cohesion: 0.48
Nodes (6): account, fragmented(), handle(), out(), reply(), usage

## Knowledge Gaps
- **5 isolated node(s):** `@opencode/client`, `@opencode/theme`, `@types/bun`, `@types/node`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 205 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `QuotaSnapshot` connect `QuotaService` to `views.tsx`, `transport.ts`, `service.ts`, `src/index.ts`, `QuotaController`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `@opencode/client`, `@opencode/theme`, `@types/bun` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `views.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07497741644083107 - nodes in this community are weakly interconnected._
- **Why does `@opencode/plugin` connect `src/index.ts` to `views.tsx`, `package.json`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `transport.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06453634085213032 - nodes in this community are weakly interconnected._
- **Why does `QuotaService` connect `QuotaService` to `service.ts`, `src/index.ts`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08421985815602837 - nodes in this community are weakly interconnected._