# cli-foundation Specification

## Purpose
Define the stable baseline behavior of the `suit` CLI so contributors can discover commands, invoke implemented workflows, and receive deterministic failures for placeholder or invalid command paths.
## Requirements
### Requirement: Executable suit command
The system SHALL expose a `suit` executable from the CLI package so contributors can invoke the command line interface from the project workspace.

#### Scenario: Contributor requests CLI help
- **WHEN** the contributor runs the `suit` executable with `--help`
- **THEN** the CLI displays usage information instead of failing with a missing binary or unresolved entrypoint error

### Requirement: V0.1 command surface registration
The CLI SHALL register top-level commands for `init`, `new`, `extract`, `validate`, `inspect`, `redact`, `pack`, `unpack`, `publish`, `pull`, `add`, `apply`, and `serve`.

#### Scenario: Contributor inspects available commands
- **WHEN** the contributor views CLI help output
- **THEN** the output lists the top-level command names required for the current product surface, including `serve`

### Requirement: Predictable placeholder command behavior
The system SHALL make every registered but unimplemented command exit with a non-zero status and a message stating that the command is not implemented yet, while allowing commands with real implementations to return their command-specific results.

#### Scenario: Contributor invokes an unimplemented command
- **WHEN** the contributor runs a registered command whose business logic has not been added yet
- **THEN** the CLI returns a deterministic not-implemented message and does not pretend the command succeeded

#### Scenario: Contributor invokes an implemented command
- **WHEN** the contributor runs a registered command that has real business behavior, including `serve`
- **THEN** the CLI executes that behavior instead of returning the placeholder not-implemented message

### Requirement: `suit serve` SHALL support explicit base-agent selection
The CLI SHALL allow contributors to select a base agent explicitly when running `suit serve` so the runtime can bind a real adapter such as `claude-code` instead of always using the default mock adapter.

#### Scenario: Contributor selects Claude from `suit serve`
- **WHEN** the contributor runs `suit serve <path> --base-agent claude-code`
- **THEN** the CLI starts the runtime host with the Claude adapter selected instead of the default mock adapter

### Requirement: `suit serve` SHALL fail predictably for unavailable selected base agents
The CLI SHALL return a deterministic non-zero failure with a contributor-facing message when `suit serve` is asked to use a selected base agent that is unknown or unavailable.

#### Scenario: Contributor requests an unavailable base agent
- **WHEN** the contributor runs `suit serve <path> --base-agent claude-code` and the Claude adapter reports that Claude is unavailable
- **THEN** the CLI exits non-zero with a deterministic message that identifies the selected base agent and the availability problem

### Requirement: `suit serve` SHALL support explicit IM exposure startup
The CLI SHALL allow contributors to start the runtime with an explicit IM exposure mode so Discord can be enabled as the first IM plugin without changing the default non-IM serve behavior.

#### Scenario: Contributor enables Discord IM exposure from `suit serve`
- **WHEN** the contributor runs `suit serve <path> --expose im --im-adapter discord`
- **THEN** the CLI starts the runtime with the Discord IM plugin enabled in addition to the selected runtime and base-agent configuration

### Requirement: `suit serve` SHALL fail predictably for invalid IM plugin configuration
The CLI SHALL return a deterministic non-zero failure with a contributor-facing message when IM exposure is requested but the selected IM adapter or its required environment configuration is missing or invalid.

#### Scenario: Contributor requests Discord IM exposure without valid configuration
- **WHEN** the contributor runs `suit serve <path> --expose im --im-adapter discord` but the Discord plugin configuration is incomplete or invalid
- **THEN** the CLI exits non-zero with a deterministic message that identifies the invalid IM exposure configuration

### Requirement: `suit serve` SHALL resolve channel exposure plugins through discovery
The CLI SHALL resolve requested channel exposure plugins through the discovered exposure plugin definitions provided to the host instead of hardcoding platform-specific branches inside the command implementation.

#### Scenario: Contributor enables a discovered IM plugin from `suit serve`
- **WHEN** the contributor runs `suit serve <path> --expose im --im-adapter discord`
- **THEN** the CLI asks the exposure plugin host to resolve `im/discord` from discovered plugin definitions and starts the selected plugin without directly hardcoding the Discord implementation in the command

#### Scenario: Contributor requests an exposure plugin that is not discovered
- **WHEN** the contributor runs `suit serve <path> --expose im --im-adapter slack` but no discovered plugin definition provides `im/slack`
- **THEN** the CLI exits non-zero with a deterministic message that identifies the missing discovered exposure plugin
