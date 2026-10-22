# Graph Report - opencode-sidebar-quota-usage  (2026-10-22)

## Corpus Check
- 72 files · ~38,768 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .lock 1, .toml 1)

## Summary
- 642 nodes · 1205 edges · 35 communities (24 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1db6b72a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- views.tsx
- architecture.test.ts
- service.ts
- codex.ts
- package.json
- QuotaService
- Requirements
- src/index.ts
- ADDED Requirements
- setup
- opencode-subscription-quota
- ADDED Requirements
- Requirements
- compilerOptions
- ADDED Requirements
- openspec-explore/SKILL.md
- opsx-explore.md
- Requirements
- ADDED Requirements
- Decisions
- AGENTS.md
- 2026-10-22-add-subscription-quota-plugin/tasks.md
- 2026-10-22-add-subscription-quota-plugin/proposal.md
- rename-to-quotabar-and-add-publish-workflow/proposal.md
- rename-to-quotabar-and-add-publish-workflow/tasks.md
- opencode-sidebar-quota-usage-95o2--initial-commit.md
- opencode-sidebar-quota-usage-rali--sync-specs-and-archive-add-subscription-quota-plug.md
- opencode.json

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
- `Decisions` --references--> `files()`  [INFERRED]
  openspec/changes/rename-to-quotabar-and-add-publish-workflow/design.md → test/architecture.test.ts
- `fail()` --calls--> `CollectError`  [EXTRACTED]
  test/service-harness.ts → src/diagnostics.ts
- `Fake` --references--> `QuotaSnapshot`  [EXTRACTED]
  test/server-plugin.test.ts → src/domain.ts
- `TestClock` --implements--> `Clock`  [EXTRACTED]
  test/helpers.ts → src/options.ts
- `harness()` --calls--> `QuotaService`  [EXTRACTED]
  test/service-harness.ts → src/service.ts

## Import Cycles
- None detected.

## Communities (35 total, 11 thin omitted)

### Community 0 - "views.tsx"
Cohesion: 0.08
Nodes (56): @opentui/solid, solid-js, QuotaRow, QuotaSnapshot, ControllerState, CODE_LABEL, formatAge(), formatDuration() (+48 more)

### Community 1 - "architecture.test.ts"
Cohesion: 0.10
Nodes (16): Context, Decisions, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs, files(), src (+8 more)

### Community 2 - "service.ts"
Cohesion: 0.10
Nodes (28): Collection, Collector, COMMON, DISCONNECTED, INCOMPATIBLE_AUTH, Source, Text, UNAVAILABLE (+20 more)

### Community 3 - "codex.ts"
Cohesion: 0.06
Nodes (53): ClaudeDeps, createClaudeCollector(), identity(), abortError(), buildChildEnv(), classifyControlError(), classifyStderr(), CLAUDE_ARGS (+45 more)

### Community 4 - "package.json"
Cohesion: 0.05
Nodes (42): bugs, url, dependencies, @opencode/client, @opencode/plugin, zod, description, devDependencies (+34 more)

### Community 5 - "QuotaService"
Cohesion: 0.16
Nodes (6): describe(), diagnose(), setup(), Clock, QuotaService, ServiceDeps

### Community 6 - "Requirements"
Cohesion: 0.07
Nodes (26): Purpose, Requirement: Account-bound collection, Requirement: Bounded and isolated CLI execution, Requirement: Codex subscription collection, Requirement: Credential-free snapshots, Requirement: Dynamic and partial quota normalization, Requirement: Prompt-free Claude usage collection, Requirement: Supported integration discovery (+18 more)

### Community 7 - "src/index.ts"
Cohesion: 0.07
Nodes (30): @opencode/plugin, zod, CodexCredential, DIAGNOSTIC_CODES, DiagnosticCode, diagnosticSchema, EMPTY_SNAPSHOT, INTEGRATIONS (+22 more)

### Community 8 - "ADDED Requirements"
Cohesion: 0.08
Nodes (24): ADDED Requirements, Requirement: Account-bound collection, Requirement: Bounded and isolated CLI execution, Requirement: Codex subscription collection, Requirement: Credential-free snapshots, Requirement: Dynamic and partial quota normalization, Requirement: Prompt-free Claude usage collection, Requirement: Supported integration discovery (+16 more)

### Community 9 - "setup"
Cohesion: 0.12
Nodes (9): QuotaController, QuotaPort, setup(), Details(), open(), detailsCommands(), DetailsKeyApi, KeyCommand (+1 more)

### Community 10 - "opencode-subscription-quota"
Cohesion: 0.10
Nodes (19): Claude: how it works, and its limits, Codex, Cutting a release, Development, Diagnostics, From a local checkout, From a package, Install (+11 more)

### Community 11 - "ADDED Requirements"
Cohesion: 0.09
Nodes (21): ADDED Requirements, Requirement: Consistent package identity, Requirement: Documented release procedure, Requirement: Publish guards, Requirement: Publishable repository metadata, Requirement: Release-triggered publishing, Requirement: Tokenless Trusted Publishing, Requirement: User-visible wording is unchanged (+13 more)

### Community 12 - "Requirements"
Cohesion: 0.10
Nodes (19): Purpose, quota-refresh-lifecycle Specification, Requirement: Account invalidation and cleanup, Requirement: Activity-aware scheduling, Requirement: Backoff-aware manual refresh, Requirement: Freshness independent of attempt status, Requirement: Independent bounded refresh, Requirement: Reset requires confirmation (+11 more)

### Community 13 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, jsx, jsxImportSource, module, moduleResolution, noEmit, noUncheckedIndexedAccess (+5 more)

### Community 14 - "ADDED Requirements"
Cohesion: 0.11
Nodes (17): ADDED Requirements, Requirement: Account invalidation and cleanup, Requirement: Activity-aware scheduling, Requirement: Backoff-aware manual refresh, Requirement: Freshness independent of attempt status, Requirement: Independent bounded refresh, Requirement: Reset requires confirmation, Scenario: Concurrent clients (+9 more)

### Community 15 - "openspec-explore/SKILL.md"
Cohesion: 0.18
Nodes (10): Check for context, Ending Discovery, Guardrails, Handling Different Entry Points, OpenSpec Awareness, The Stance, What You Don't Have To Do, What You Might Do (+2 more)

### Community 16 - "opsx-explore.md"
Cohesion: 0.20
Nodes (9): Check for context, Ending Discovery, Guardrails, OpenSpec Awareness, The Stance, What You Don't Have To Do, What You Might Do, When a change exists (+1 more)

### Community 17 - "Requirements"
Cohesion: 0.11
Nodes (17): Purpose, quota-visibility-and-diagnostics Specification, Requirement: Accessible presentation preferences, Requirement: Actionable sanitized diagnostics, Requirement: Explicit unavailable and stale states, Requirement: Local and remote execution guidance, Requirement: Subscription sidebar and details, Requirements (+9 more)

### Community 18 - "ADDED Requirements"
Cohesion: 0.12
Nodes (15): ADDED Requirements, Requirement: Accessible presentation preferences, Requirement: Actionable sanitized diagnostics, Requirement: Explicit unavailable and stale states, Requirement: Local and remote execution guidance, Requirement: Subscription sidebar and details, Scenario: Authorization failures differ, Scenario: Claude cannot be queried (+7 more)

### Community 19 - "Decisions"
Cohesion: 0.13
Nodes (14): 1. Split server collection from terminal presentation, 2. Discover integrations before attempting collection, 3. Use a minimal Claude control-protocol adapter, 4. Keep provider-specific parsing explicit, 5. Separate collection state, completeness, and freshness, 6. Use an account-safe per-location scheduler, 7. Prefer truthful, compact UI over inferred precision, Context (+6 more)

### Community 27 - "2026-10-22-add-subscription-quota-plugin/tasks.md"
Cohesion: 0.25
Nodes (7): 1. Package and compatibility foundation, 2. Domain model and discovery, 3. Codex collector, 4. Claude CLI transport and collector, 5. Refresh lifecycle and RPC, 6. Terminal UI and diagnostics, 7. Release validation and documentation

### Community 28 - "2026-10-22-add-subscription-quota-plugin/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 29 - "rename-to-quotabar-and-add-publish-workflow/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 30 - "rename-to-quotabar-and-add-publish-workflow/tasks.md"
Cohesion: 0.33
Nodes (5): 1. Rename package and identifiers, 2. Package metadata, 3. Publish workflow, 4. Documentation, 5. Verification

## Knowledge Gaps
- **5 isolated node(s):** `@opencode/client`, `@opencode/theme`, `@types/bun`, `@types/node`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 288 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@opencode/plugin` connect `src/index.ts` to `views.tsx`, `package.json`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `@opencode/client`, `@opencode/theme`, `@types/bun` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `views.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07678410117434507 - nodes in this community are weakly interconnected._
- **Why does `QuotaSnapshot` connect `views.tsx` to `service.ts`, `QuotaService`, `src/index.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `architecture.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10144927536231885 - nodes in this community are weakly interconnected._
- **Why does `QuotaService` connect `QuotaService` to `service.ts`, `src/index.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09565217391304348 - nodes in this community are weakly interconnected._