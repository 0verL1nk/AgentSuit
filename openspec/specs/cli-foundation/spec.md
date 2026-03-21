## ADDED Requirements

### Requirement: Executable suit command
The system SHALL expose a `suit` executable from the CLI package so contributors can invoke the command line interface from the project workspace.

#### Scenario: Contributor requests CLI help
- **WHEN** the contributor runs the `suit` executable with `--help`
- **THEN** the CLI displays usage information instead of failing with a missing binary or unresolved entrypoint error

### Requirement: V0.1 command surface registration
The CLI SHALL register top-level commands for `init`, `new`, `extract`, `validate`, `inspect`, `redact`, `pack`, `unpack`, `publish`, `pull`, `add`, and `apply`.

#### Scenario: Contributor inspects available commands
- **WHEN** the contributor views CLI help output
- **THEN** the output lists the top-level command names required for the v0.1 product surface

### Requirement: Predictable placeholder command behavior
The system SHALL make every registered but unimplemented command exit with a non-zero status and a message stating that the command is not implemented yet, while allowing commands with real implementations to return their command-specific results.

#### Scenario: Contributor invokes an unimplemented command
- **WHEN** the contributor runs a registered command whose business logic has not been added yet
- **THEN** the CLI returns a deterministic not-implemented message and does not pretend the command succeeded

#### Scenario: Contributor invokes an implemented command
- **WHEN** the contributor runs a registered command that has real business behavior
- **THEN** the CLI executes that behavior instead of returning the placeholder not-implemented message
