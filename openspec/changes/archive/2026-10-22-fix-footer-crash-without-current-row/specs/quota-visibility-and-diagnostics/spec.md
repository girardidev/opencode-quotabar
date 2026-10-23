## ADDED Requirements

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
