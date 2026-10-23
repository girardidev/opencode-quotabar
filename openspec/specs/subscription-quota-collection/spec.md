# subscription-quota-collection Specification

## Purpose
TBD - created by archiving change add-subscription-quota-plugin. Update Purpose after archive.
## Requirements
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

### Requirement: Codex subscription collection
The system SHALL collect Codex account windows using the active OpenAI OAuth connection resolved through OpenCode, including its account selector when available, and SHALL reject API-key authentication as incompatible with subscription collection.

#### Scenario: Successful OAuth response
- **WHEN** a valid Codex response contains multiple usage windows
- **THEN** each valid window is normalized with its own used/remaining percentage and available reset time

#### Scenario: API-key connection
- **WHEN** the active OpenAI connection is an API key
- **THEN** the row explains that subscription usage requires OAuth and no subscription request is sent with that key

### Requirement: Prompt-free Claude usage collection
The system SHALL obtain Claude usage through the authenticated server-local Claude CLI by sending only initialization and usage control operations with behavior analysis disabled. It MUST NOT send model prompts, extract CLI credentials, resume conversations, or fall back to model generation.

#### Scenario: Supported CLI
- **WHEN** the CLI accepts initialization and `get_usage` with `skip_behaviors: true`
- **THEN** the collector returns validated subscription usage without sending a user message

#### Scenario: Unsupported protocol
- **WHEN** the CLI rejects the usage control operation or required isolation flags
- **THEN** the collector reports an actionable compatibility error and terminates without attempting a prompt fallback

#### Scenario: CLI is unavailable or signed out
- **WHEN** the server cannot find the CLI or its authentication does not represent a first-party subscription
- **THEN** the row identifies the server-side prerequisite and does not attempt token extraction or login

### Requirement: Bounded and isolated CLI execution
The system SHALL launch the CLI without a shell, without session persistence, with customizations/tools/MCP disabled through supported controls, and with provider credential overrides removed. It SHALL bound execution time and captured output and reap the child on completion, failure, cancellation, or unload.

#### Scenario: Process timeout
- **WHEN** the CLI does not return a matching response within the configured deadline
- **THEN** the child is terminated and reaped and the collector returns a timeout diagnostic

#### Scenario: Unexpected output
- **WHEN** stdout contains unrelated events, malformed protocol content, or exceeds the output cap
- **THEN** unrelated valid events do not become quota data and malformed or oversized protocol output produces a sanitized error with child cleanup

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

### Requirement: Dynamic and partial quota normalization
The system SHALL prefer valid Claude `limits` rows, preserve their meter kind/group/scope/order/severity/active indicator, and use known legacy windows only when rows are absent or null. It SHALL keep unknown values distinct from zero and SHALL NOT derive subscription quota from session tokens or monetary estimates.

#### Scenario: Explicitly empty rows
- **WHEN** the provider returns an empty `limits` array
- **THEN** the system reports no returned meters rather than reconstructing windows from legacy fields

#### Scenario: Legacy percentages
- **WHEN** Claude returns a legacy window with utilization 22 and no dynamic rows
- **THEN** the window shows 22 percent used and 78 percent remaining, not a fraction-based conversion

#### Scenario: Partially valid response
- **WHEN** some windows are valid and others have invalid percentages or missing optional values
- **THEN** valid windows remain visible with partial diagnostics, invalid percentages do not become healthy values, and absent resets remain unknown

#### Scenario: Optional windows and extra usage
- **WHEN** optional model windows are null and extra usage is disabled
- **THEN** null windows are omitted and disabled extra usage is normal metadata, not an authentication or collection error

### Requirement: Credential-free snapshots
The system MUST NOT expose credentials, authorization headers, raw CLI output, raw account identifiers, or raw upstream responses in RPC, UI, persisted preferences, test fixtures, or diagnostic logs.

#### Scenario: Sensitive upstream failure
- **WHEN** an upstream error or child stderr contains sensitive content
- **THEN** only an allowlisted error code, safe explanation, and next action reach the client or logs

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

