## MODIFIED Requirements

### Requirement: Supported integration discovery
The system SHALL discover OpenCode's `openai` integration and the Claude row using identifiers and connection capabilities, and SHALL retain a diagnostic row for each detected supported integration even if collection cannot start. The Claude row SHALL be detected from the OpenChamber `claude-code` identifier, as an integration or as a provider, or from the `anthropic` identifier as a provider in use, and SHALL appear once when both are present. An `anthropic` integration that is merely available, with no `anthropic` provider in use, SHALL NOT produce a row. Matching SHALL use identifiers only, never display names, and providers other than these SHALL NOT be detected.

#### Scenario: Missing connection
- **WHEN** a supported integration that requires a connection is detected without an active connection
- **THEN** its row reports a disconnected state and a connection action rather than disappearing

#### Scenario: Claude marker is not an Anthropic credential
- **WHEN** the detected `claude-code` connection contains an OAuth-shaped CLI sign-in marker
- **THEN** the system selects the CLI collector and never uses that marker as an Anthropic bearer token

#### Scenario: Anthropic served by another plugin
- **WHEN** the `anthropic` provider is present and no `claude-code` integration exists
- **THEN** the Claude row is detected and collects through the server-local CLI without an OpenCode connection

#### Scenario: Anthropic integration available but unused
- **WHEN** the `anthropic` integration is listed but no `anthropic` provider is in use
- **THEN** no Claude row is detected

#### Scenario: Both identifiers present
- **WHEN** both `claude-code` and `anthropic` are present
- **THEN** a single Claude row is shown, using the `claude-code` connection when the host provides one

#### Scenario: Unrelated providers and display names
- **WHEN** other providers such as `openrouter` are present, or a display name equals "Claude" without a supported identifier
- **THEN** no additional row is detected

### Requirement: Account-bound collection
The system SHALL identify the collector's account boundary without exposing raw account identifiers and SHALL discard data when the account changes during collection. Claude snapshots SHALL identify the server-local CLI as their authentication source rather than asserting the OpenCode marker contains the real account credential. When no OpenCode connection exists, the Claude account boundary SHALL derive from the verified CLI account identity alone.

#### Scenario: CLI account changes
- **WHEN** the CLI account identity differs before and after a usage request
- **THEN** the result is discarded and prior account readings are invalidated

#### Scenario: Identity cannot be verified
- **WHEN** a supported environment cannot provide a reliable CLI account identity
- **THEN** the row reports identity ambiguity and earlier account readings are not reused across the unverifiable boundary

#### Scenario: Connection-free account boundary
- **WHEN** the Claude row collects without an OpenCode connection and the CLI reports a verifiable account identity
- **THEN** the reading is bound to that identity and is not reused if a later collection reports a different identity

## ADDED Requirements

### Requirement: Connection-optional Claude collection
The system SHALL collect Claude usage without requiring an active OpenCode connection, because authentication belongs to the server-local CLI. The absence of a connection SHALL NOT make the Claude row report a disconnected state, and a missing or signed-out CLI SHALL be reported through the CLI prerequisite diagnostics.

#### Scenario: Collection without a connection
- **WHEN** the Claude row is detected and the host reports no active connection for it
- **THEN** collection starts on the normal schedule and the row reflects the CLI result

#### Scenario: Missing CLI without a connection
- **WHEN** the Claude row is detected without a connection and the server cannot find the CLI
- **THEN** the row identifies the server-side prerequisite instead of a disconnected state, and failures follow the usual backoff

#### Scenario: Other integrations still need a connection
- **WHEN** the `openai` integration is detected without an active connection
- **THEN** no collection starts and its row reports a disconnected state
