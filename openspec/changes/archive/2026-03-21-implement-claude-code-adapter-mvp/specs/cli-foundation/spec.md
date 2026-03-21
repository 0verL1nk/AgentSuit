## ADDED Requirements

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
