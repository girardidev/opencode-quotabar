## ADDED Requirements

### Requirement: Subscription sidebar and details
The TUI SHALL display compact subscription rows, highlight the selected supported provider, and provide a keyboard-accessible details view with all returned windows, source, observation age, collection state, completeness, and refresh controls.

#### Scenario: Successful multi-window reading
- **WHEN** a provider has multiple valid windows
- **THEN** expanded UI identifies percentages as remaining and shows each available reset alongside the corresponding window

#### Scenario: Compact summary
- **WHEN** a row is collapsed
- **THEN** its summary uses the server-designated active meter when available, otherwise the lowest known remaining window, and uses that same meter's reset

### Requirement: Explicit unavailable and stale states
The TUI SHALL distinguish loading, disconnected, incompatible authentication, unavailable, partial, stale, and error conditions without hiding a detected supported integration because of collection failure. Unknown percentages SHALL have no percentage bar.

#### Scenario: Claude cannot be queried
- **WHEN** Claude is detected but its CLI is missing or incompatible
- **THEN** Claude remains visible with a meaningful status and a path to details rather than disappearing

#### Scenario: Reading has no percentage
- **WHEN** a response has only status/reset metadata and no utilization
- **THEN** the TUI displays available metadata without rendering a fabricated zero/full quota bar

### Requirement: Actionable sanitized diagnostics
The details view SHALL present stable error codes, safe explanations, next actions, and next retry time when applicable. Unauthorized, forbidden, rate-limited, timeout, network, incompatible protocol, and invalid-response failures SHALL remain distinguishable.

#### Scenario: Authorization failures differ
- **WHEN** one request fails with HTTP 401 and another with HTTP 403
- **THEN** the UI distinguishes authentication rejection from denied access instead of merging both into a generic sign-in message

#### Scenario: Server plugin is unavailable
- **WHEN** the TUI cannot reach the quota RPC service
- **THEN** it explains the server-plugin prerequisite, preserves any prior displayed readings as stale, and does not claim the provider itself failed

### Requirement: Accessible presentation preferences
The TUI SHALL support keyboard access to details and refresh, use semantic theme colors plus text statuses, and remain usable in narrow terminals. Only presentation preferences SHALL be persisted. Explicitly hidden rows SHALL remain discoverable in details/manage views.

#### Scenario: User hides a provider
- **WHEN** a user explicitly hides a row from the sidebar
- **THEN** the details/manage view still lists it as hidden by preference with a way to show it again

#### Scenario: Narrow or non-color display
- **WHEN** terminal width is constrained or colors cannot be distinguished
- **THEN** textual status and keyboard diagnostics remain available without relying solely on color or mouse interaction

### Requirement: Local and remote execution guidance
The plugin SHALL document host compatibility, server/TUI loading, connection prerequisites, and remote-server CLI authentication requirements without automatically editing user configuration or transferring credentials.

#### Scenario: Remote server lacks Claude authentication
- **WHEN** a TUI connects to a server whose Claude CLI is absent or signed out
- **THEN** diagnostics identify the server-side prerequisite and never attempt to use the client's local credential store implicitly
