# quota-visibility-and-diagnostics Specification

## Purpose
TBD - created by archiving change add-subscription-quota-plugin. Update Purpose after archive.
## Requirements
### Requirement: Subscription sidebar and details
The TUI SHALL display compact subscription rows, highlight the selected supported provider, and provide a keyboard-accessible details view with all returned windows, source, observation age, collection state, completeness, and refresh controls. Expanded window readings in sidebar and details SHALL place the window label, active marker when present, and reset time together, with the selected-mode percentage aligned to the right and the meter on the next line when space permits. Compact window readings SHALL omit the `resets in` prefix and `left` suffix without omitting information.

#### Scenario: Successful multi-window reading
- **WHEN** a provider has multiple valid windows
- **THEN** expanded UI displays each window's percentage in the selected remaining/used mode and shows each available reset alongside the corresponding window label

#### Scenario: Compact summary
- **WHEN** a row is collapsed
- **THEN** its summary uses the server-designated active meter when available, otherwise the lowest known remaining window, displays its percentage in the selected mode, and uses that same meter's reset

#### Scenario: Compact window layout
- **WHEN** an expanded window has a known percentage and a future reset and its content fits the available width
- **THEN** its first line displays the label, active marker when applicable, a middle-dot separator, and the full reset duration with the bare percentage at the right, and its second line displays the meter
- **AND** the reset is muted and durations retain precision such as `1h 8m` or `6d 16h`

#### Scenario: Unknown or elapsed reset
- **WHEN** a window's reset time is missing or has passed without a fresh reading
- **THEN** its reset text remains explicitly unknown or pending refresh respectively, and its displayed quota is not assumed replenished

#### Scenario: Compact content does not fit
- **WHEN** label, reset, and percentage cannot fit on one line
- **THEN** the UI uses additional lines without truncating or dropping those fields and continues to omit meters below the existing narrow-width threshold

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
The TUI SHALL support keyboard access to details and refresh, use semantic theme colors plus text statuses, and remain usable in narrow terminals. Only presentation preferences SHALL be persisted. Explicitly hidden rows SHALL remain discoverable in details/manage views. A single persisted display-mode preference SHALL offer `Remaining` and `Used` for sidebar and details, default to `Remaining` for missing or invalid values, and be changeable through a visible, keyboard-accessible control in details.

#### Scenario: User hides a provider
- **WHEN** a user explicitly hides a row from the sidebar
- **THEN** the details/manage view still lists it as hidden by preference with a way to show it again

#### Scenario: Narrow or non-color display
- **WHEN** terminal width is constrained or colors cannot be distinguished
- **THEN** textual status and keyboard diagnostics remain available without relying solely on color or mouse interaction

#### Scenario: Legacy presentation preferences
- **WHEN** stored preferences have no valid display mode
- **THEN** sidebar and details use remaining mode and existing hidden and collapse preferences remain intact

#### Scenario: Changing the shared mode
- **WHEN** the user changes the display-mode control by keyboard or mouse
- **THEN** all sidebar readings, including collapsed summaries, and details readings immediately use the selected mode without requiring a provider refresh
- **AND** details identifies the current mode in text and the control remains available even when no provider rows exist

#### Scenario: Preference survives reopening
- **WHEN** the user saves used mode and later reopens details or restarts the TUI
- **THEN** both sidebar and details continue to use used mode

### Requirement: Local and remote execution guidance
The plugin SHALL document host compatibility, server/TUI loading, connection prerequisites, and remote-server CLI authentication requirements without automatically editing user configuration or transferring credentials.

#### Scenario: Remote server lacks Claude authentication
- **WHEN** a TUI connects to a server whose Claude CLI is absent or signed out
- **THEN** diagnostics identify the server-side prerequisite and never attempt to use the client's local credential store implicitly


### Requirement: Footer status tolerates providers without a quota row
The TUI SHALL show the prompt footer status only when the current model's provider has a quota row that is not hidden, and SHALL NOT fail when the current provider has no row or when the current provider changes while the plugin is mounted.

#### Scenario: Provider without a quota row
- **WHEN** the current model's provider has no quota row in the snapshot
- **THEN** the footer renders nothing and the plugin does not report a slot error

#### Scenario: Current provider changes to one without a row
- **WHEN** the footer is showing a provider's row and the current model changes to a provider without a row
- **THEN** the footer is removed without error and the sidebar and details view keep working

#### Scenario: Current provider has a visible row
- **WHEN** the current model's provider has a quota row that is not hidden
- **THEN** the footer shows the provider name and headline meter as before, marked stale when the row or the service is stale

#### Scenario: Current provider row is hidden
- **WHEN** the current model's provider has a quota row hidden by preference
- **THEN** the footer renders nothing

### Requirement: Consistent quota display direction
Remaining mode SHALL display canonical remaining allowance and used mode SHALL display `100 - remaining`, converting before percentage rounding. The meter SHALL represent the same selected quantity as the text. Exhaustion colors, active-window selection, reset timing, freshness, and diagnostic state SHALL remain independent of display mode. Canonical snapshots SHALL NOT be modified by this preference.

#### Scenario: Used percentage and meter
- **WHEN** a window reports 80% remaining and used mode is selected
- **THEN** sidebar and details display `20%` and a meter filled to 20%, with unchanged reset time

#### Scenario: Remaining percentage and meter
- **WHEN** the same window is displayed in remaining mode
- **THEN** sidebar and details display `80%` and a meter filled to 80%

#### Scenario: Exhaustion warning is direction-independent
- **WHEN** the user switches between 10% remaining and 90% used for the same reading
- **THEN** the percentage and meter retain the same quota-exhaustion severity color

#### Scenario: Unknown allowance
- **WHEN** a window has no numeric remaining value
- **THEN** both modes display an unknown allowance, preserve available reset metadata, and show no fabricated meter

#### Scenario: Conversion precedes rounding
- **WHEN** a window reports 99.6% remaining and used mode is selected
- **THEN** the displayed consumption is `<1%` rather than a misleading `0%`

#### Scenario: Exhausted and untouched allowances
- **WHEN** canonical remaining allowance is exactly 0% or 100%
- **THEN** used mode displays exactly 100% or 0% respectively, with corresponding full or empty meters

#### Scenario: Mode switch preserves selected window and states
- **WHEN** a row has an active window or stale, partial, loading, or error information and the mode changes
- **THEN** the same window and all applicable status and diagnostic information remain visible and the underlying snapshot remains unchanged
