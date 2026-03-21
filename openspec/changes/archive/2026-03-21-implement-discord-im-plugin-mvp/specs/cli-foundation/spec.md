## ADDED Requirements

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
