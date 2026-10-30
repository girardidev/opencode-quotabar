# Graph Report - opencode-quotabar  (2026-10-30)

## Corpus Check
- 83 files · ~49,959 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .lock 1, .toml 1)

## Summary
- 780 nodes · 1379 edges · 42 communities (32 shown, 10 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5aae5168`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- views.tsx
- server-plugin.test.ts
- service.ts
- codex.ts
- package.json
- QuotaService
- Requirements
- Requirement: Consistent quota display direction
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
- 2026-10-23-compact-quota-display/design.md
- 2026-10-23-compact-quota-display/proposal.md
- opencode.json
- 2026-10-23-compact-quota-display/tasks.md
- headline
- Requirement: Footer status tolerates providers without a quota row
- Requirement: Supported integration discovery
- server-plugin.test.ts
- 2026-10-23-show-claude-quota-for-anthropic-provider/proposal.md

## God Nodes (most connected - your core abstractions)
1. `QuotaService` - 29 edges
2. `QuotaSnapshot` - 21 edges
3. `DetailsView()` - 21 edges
4. `CollectError` - 20 edges
5. `setup()` - 15 edges
6. `SupportedIntegration` - 14 edges
7. `SidebarRow()` - 14 edges
8. `QuotaController` - 13 edges
9. `isRecord()` - 12 edges
10. `QuotaWindow` - 12 edges

## Surprising Connections (you probably didn't know these)
- `3. Convert only at the presentation boundary` --references--> `formatRemaining()`  [INFERRED]
  openspec/changes/archive/2026-10-23-compact-quota-display/design.md → src/tui/format.ts
- `2. Persist a single presentation mode` --references--> `Prefs`  [INFERRED]
  openspec/changes/archive/2026-10-23-compact-quota-display/design.md → src/tui/model.ts
- `2. Discovery` --references--> `Detected`  [INFERRED]
  openspec/changes/archive/2026-10-23-show-claude-quota-for-anthropic-provider/tasks.md → src/discovery.ts
- `Open Questions` --references--> `headline()`  [INFERRED]
  openspec/changes/archive/2026-10-22-fix-footer-crash-without-current-row/design.md → src/tui/format.ts
- `Decisions` --references--> `Detected`  [INFERRED]
  openspec/changes/archive/2026-10-23-show-claude-quota-for-anthropic-provider/design.md → src/discovery.ts

## Import Cycles
- None detected.

## Communities (42 total, 10 thin omitted)

### Community 0 - "views.tsx"
Cohesion: 0.08
Nodes (58): Context, @opentui/solid, solid-js, QuotaRow, QuotaSnapshot, ControllerState, CODE_LABEL, displayPercent() (+50 more)

### Community 1 - "server-plugin.test.ts"
Cohesion: 0.08
Nodes (24): @opencode/plugin, zod, DIAGNOSTIC_CODES, DiagnosticCode, diagnosticSchema, EMPTY_SNAPSHOT, INTEGRATIONS, rowSchema (+16 more)

### Community 2 - "service.ts"
Cohesion: 0.06
Nodes (39): Decisions, 1. Spike: what the host reports, 2. Discovery, 3. Scheduler, 4. Collector wiring, 5. Verify, Collector, COMMON (+31 more)

### Community 3 - "codex.ts"
Cohesion: 0.07
Nodes (53): ClaudeDeps, createClaudeCollector(), identity(), abortError(), buildChildEnv(), classifyControlError(), classifyStderr(), CLAUDE_ARGS (+45 more)

### Community 4 - "package.json"
Cohesion: 0.05
Nodes (42): bugs, url, dependencies, @opencode/client, @opencode/plugin, zod, description, devDependencies (+34 more)

### Community 5 - "QuotaService"
Cohesion: 0.15
Nodes (6): Context, Goals / Non-Goals, Open Questions, Risks / Trade-offs, setup(), QuotaService

### Community 6 - "Requirements"
Cohesion: 0.06
Nodes (35): Purpose, Requirement: Account-bound collection, Requirement: Bounded and isolated CLI execution, Requirement: Codex subscription collection, Requirement: Connection-optional Claude collection, Requirement: Credential-free snapshots, Requirement: Dynamic and partial quota normalization, Requirement: Prompt-free Claude usage collection (+27 more)

### Community 7 - "Requirement: Consistent quota display direction"
Cohesion: 0.09
Nodes (22): ADDED Requirements, MODIFIED Requirements, Requirement: Accessible presentation preferences, Requirement: Consistent quota display direction, Requirement: Subscription sidebar and details, Scenario: Changing the shared mode, Scenario: Compact content does not fit, Scenario: Compact summary (+14 more)

### Community 8 - "ADDED Requirements"
Cohesion: 0.08
Nodes (24): ADDED Requirements, Requirement: Account-bound collection, Requirement: Bounded and isolated CLI execution, Requirement: Codex subscription collection, Requirement: Credential-free snapshots, Requirement: Dynamic and partial quota normalization, Requirement: Prompt-free Claude usage collection, Requirement: Supported integration discovery (+16 more)

### Community 9 - "setup"
Cohesion: 0.11
Nodes (10): QuotaController, QuotaPort, setup(), Details(), open(), detailsCommands(), DetailsKeyApi, KeyCommand (+2 more)

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
Cohesion: 0.05
Nodes (36): Purpose, quota-visibility-and-diagnostics Specification, Requirement: Accessible presentation preferences, Requirement: Actionable sanitized diagnostics, Requirement: Consistent quota display direction, Requirement: Explicit unavailable and stale states, Requirement: Footer status tolerates providers without a quota row, Requirement: Local and remote execution guidance (+28 more)

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

### Community 31 - "2026-10-23-compact-quota-display/design.md"
Cohesion: 0.22
Nodes (8): 1. Recompose the shared window block, 2. Persist a single presentation mode, 3. Convert only at the presentation boundary, Decisions, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs

### Community 32 - "2026-10-23-compact-quota-display/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 34 - "2026-10-23-compact-quota-display/tasks.md"
Cohesion: 0.40
Nodes (4): 1. Presentation preference and formatting, 2. Compact quota rendering, 3. Global preference control, 4. Verification and documentation

### Community 35 - "headline"
Cohesion: 0.14
Nodes (16): Context, Decisions, Goals / Non-Goals, Open Questions, Risks / Trade-offs, Capabilities, Impact, Modified Capabilities (+8 more)

### Community 36 - "Requirement: Footer status tolerates providers without a quota row"
Cohesion: 0.29
Nodes (6): ADDED Requirements, Requirement: Footer status tolerates providers without a quota row, Scenario: Current provider changes to one without a row, Scenario: Current provider has a visible row, Scenario: Current provider row is hidden, Scenario: Provider without a quota row

### Community 37 - "Requirement: Supported integration discovery"
Cohesion: 0.11
Nodes (17): ADDED Requirements, MODIFIED Requirements, Requirement: Account-bound collection, Requirement: Connection-optional Claude collection, Requirement: Supported integration discovery, Scenario: Anthropic integration available but unused, Scenario: Anthropic served by another plugin, Scenario: Both identifiers present (+9 more)

### Community 40 - "server-plugin.test.ts"
Cohesion: 0.07
Nodes (24): Context, Decisions, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs, files(), src (+16 more)

### Community 41 - "2026-10-23-show-claude-quota-for-anthropic-provider/proposal.md"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

## Knowledge Gaps
- **5 isolated node(s):** `@opencode/client`, `@opencode/theme`, `@types/bun`, `@types/node`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 379 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `QuotaSnapshot` connect `views.tsx` to `server-plugin.test.ts`, `server-plugin.test.ts`, `service.ts`, `QuotaService`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `setup()` (e.g. with `.dispose()` and `.start()`) actually correct?**
  _`setup()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@opencode/client`, `@opencode/theme`, `@types/bun` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `views.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07563025210084033 - nodes in this community are weakly interconnected._
- **Why does `@opencode/plugin` connect `server-plugin.test.ts` to `views.tsx`, `package.json`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `server-plugin.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08235294117647059 - nodes in this community are weakly interconnected._
- **Why does `QuotaService` connect `QuotaService` to `server-plugin.test.ts`, `service.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._