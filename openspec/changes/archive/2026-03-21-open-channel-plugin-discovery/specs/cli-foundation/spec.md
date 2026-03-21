## MODIFIED Requirements

### Requirement: `suit serve` SHALL support explicit base-agent selection
The CLI SHALL allow contributors to select a base agent explicitly when running `suit serve` so the runtime can bind a real adapter such as `claude-code` instead of always using the default mock adapter. That base-agent selection SHALL remain compatible with exposure plugin startup, and the CLI SHALL pass the selected runtime configuration into the shared host instead of binding exposure implementations directly inside the command.

#### Scenario: Contributor selects Claude from `suit serve`
- **WHEN** the contributor runs `suit serve <path> --base-agent claude-code`
- **THEN** the CLI starts the runtime host with the Claude adapter selected instead of the default mock adapter

### Requirement: `suit serve` SHALL fail predictably for unavailable selected base agents
The CLI SHALL return a deterministic non-zero failure with a contributor-facing message when `suit serve` is asked to use a selected base agent that is unknown or unavailable.

#### Scenario: Contributor requests an unavailable base agent
- **WHEN** the contributor runs `suit serve <path> --base-agent claude-code` and the Claude adapter reports that Claude is unavailable
- **THEN** the CLI exits non-zero with a deterministic message that identifies the selected base agent and the availability problem

### Requirement: `suit serve` SHALL resolve channel exposure plugins through discovery
The CLI SHALL resolve requested channel exposure plugins through the discovered exposure plugin definitions provided to the host instead of hardcoding platform-specific branches inside the command implementation.

#### Scenario: Contributor enables a discovered IM plugin from `suit serve`
- **WHEN** the contributor runs `suit serve <path> --expose im --im-adapter discord`
- **THEN** the CLI asks the exposure plugin host to resolve `im/discord` from discovered plugin definitions and starts the selected plugin without directly hardcoding the Discord implementation in the command

#### Scenario: Contributor requests an exposure plugin that is not discovered
- **WHEN** the contributor runs `suit serve <path> --expose im --im-adapter slack` but no discovered plugin definition provides `im/slack`
- **THEN** the CLI exits non-zero with a deterministic message that identifies the missing discovered exposure plugin
