## MODIFIED Requirements

### Requirement: Predictable placeholder command behavior
The system SHALL make every registered but unimplemented command exit with a non-zero status and a message stating that the command is not implemented yet, while allowing commands with real implementations to return their command-specific results.

#### Scenario: Contributor invokes an unimplemented command
- **WHEN** the contributor runs a registered command whose business logic has not been added yet
- **THEN** the CLI returns a deterministic not-implemented message and does not pretend the command succeeded

#### Scenario: Contributor invokes an implemented command
- **WHEN** the contributor runs a registered command that has real business behavior
- **THEN** the CLI executes that behavior instead of returning the placeholder not-implemented message
