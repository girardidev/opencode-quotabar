# quota-refresh-lifecycle Specification

## Purpose
TBD - created by archiving change add-subscription-quota-plugin. Update Purpose after archive.
## Requirements
### Requirement: Independent bounded refresh
The system SHALL refresh accounts independently, deduplicate concurrent work for the same location/account/collector, enforce validated timeouts, and use a successful-read TTL with a default of 120 seconds.

#### Scenario: Concurrent clients
- **WHEN** two TUI clients at the same location request the same account during an in-flight refresh
- **THEN** they share one collection operation and receive its resulting snapshot

#### Scenario: One collector fails
- **WHEN** Claude collection fails while Codex collection succeeds
- **THEN** Codex is published successfully without waiting for Claude retries and Claude receives its own diagnostic

### Requirement: Activity-aware scheduling
The system SHALL pause automatic refresh when no client has renewed its two-minute activity lease and SHALL resume eligible collection when client activity returns. Snapshot reads SHALL NOT bypass a valid TTL.

#### Scenario: Idle location
- **WHEN** the last client activity is more than two minutes old
- **THEN** no new automatic HTTP request or CLI process is started for that location

### Requirement: Backoff-aware manual refresh
The system SHALL apply exponential failure backoff with jitter capped at 15 minutes, respect Retry-After as a minimum delay, and allow manual refresh to bypass successful TTL but not failure backoff.

#### Scenario: Provider throttles
- **WHEN** a provider returns HTTP 429 with a future Retry-After
- **THEN** automatic and manual requests wait until at least that deadline and the snapshot includes the next retry time

#### Scenario: Fresh successful cache
- **WHEN** a user manually refreshes an account with cached successful data and no active failure backoff
- **THEN** a new bounded collection is started despite the successful-read TTL

### Requirement: Freshness independent of attempt status
The system SHALL retain last successful windows after a failed refresh only for the same verified account, mark them stale, and preserve their original observation time separately from the latest attempt time.

#### Scenario: Failure after success
- **WHEN** a refresh fails after a successful read
- **THEN** earlier windows remain visible as stale alongside the new error and their observation timestamp is not advanced

#### Scenario: Failure before any success
- **WHEN** the first refresh fails
- **THEN** the system exposes an unavailable reading with a diagnostic and no fabricated percentage

### Requirement: Reset requires confirmation
The system SHALL NOT infer replenishment solely because a reported reset deadline has passed and SHALL refresh subject to rate limits and backoff.

#### Scenario: Deadline expires
- **WHEN** a window's reset deadline passes without a new successful reading
- **THEN** the UI indicates reset pending refresh rather than changing the window to 100 percent remaining

### Requirement: Account invalidation and cleanup
The system SHALL abort requests, clear previous account readings, and reject late results after connection/account changes. Unload SHALL stop timers/subscriptions and cancel/reap owned resources. Quota snapshots SHALL remain in memory rather than persist across restarts.

#### Scenario: Connection switches during request
- **WHEN** the active account changes while collection is in flight
- **THEN** the old result cannot populate the new account's row and old readings are cleared before new data is shown

#### Scenario: Plugin unloads
- **WHEN** the plugin unloads during HTTP or CLI collection
- **THEN** all owned requests/processes are cancelled, children reaped, timers cleared, and later responses ignored

