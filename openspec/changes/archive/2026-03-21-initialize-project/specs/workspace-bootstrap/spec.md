## ADDED Requirements

### Requirement: Root workspace tooling
The repository SHALL define a Bun-managed root workspace manifest and documented root scripts that install dependencies and run build, lint, typecheck, and test workflows across all managed packages from the repository root.

#### Scenario: Contributor runs workspace checks
- **WHEN** a contributor installs dependencies and executes the documented root quality scripts
- **THEN** the repository runs the corresponding package-level workflows without requiring the contributor to invoke each package manually

### Requirement: Standard package layout
The repository SHALL provide a stable package layout under `packages/` for `cli`, `core`, `schema`, `adapter-openclaw`, `adapter-claude-code`, `adapter-codex`, and `registry`, and SHALL share TypeScript compiler defaults from a common base configuration.

#### Scenario: Contributor inspects the source tree
- **WHEN** a contributor opens the repository after initialization
- **THEN** they can locate the expected package directories and a shared TypeScript configuration that applies consistent compiler behavior across packages

### Requirement: Bootstrap documentation and fixture
The repository SHALL include contributor-facing setup documentation and at least one minimal example or fixture asset that can be used to verify the workspace scaffold locally.

#### Scenario: New contributor follows setup guidance
- **WHEN** a new contributor reads the bootstrap documentation
- **THEN** they can install dependencies, run the documented checks, and identify the sample asset used for local verification
