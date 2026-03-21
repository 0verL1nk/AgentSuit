## ADDED Requirements

### Requirement: Create a minimal local Suit scaffold
The system SHALL implement `suit new <name>` so contributors can create a local Suit directory that follows the repository's standard structure and can serve as the starting point for later validation and packaging commands.

#### Scenario: Contributor creates a new suit
- **WHEN** the contributor runs `suit new demo-suit`
- **THEN** the command creates a `demo-suit/` directory containing at least `suit.yaml`, `README.md`, and the asset directories required by the minimal local workflow

#### Scenario: Generated scaffold is immediately usable
- **WHEN** the contributor creates a new suit with `suit new`
- **THEN** the generated manifest and asset references are internally consistent so the resulting suit can be validated without manual repairs

### Requirement: Validate a local Suit directory
The system SHALL implement `suit validate <path>` to load a local Suit directory, parse the manifest, verify required structural fields, check declared runtime values, and confirm that referenced local assets exist.

#### Scenario: Validation succeeds for a well-formed suit
- **WHEN** the contributor runs `suit validate` against a suit directory with a valid manifest and all referenced files present
- **THEN** the command exits successfully and reports that the suit passed validation

#### Scenario: Validation fails for a malformed manifest
- **WHEN** the contributor runs `suit validate` against a suit whose manifest is missing required fields or contains unsupported required values
- **THEN** the command exits non-zero and reports a schema or compatibility validation failure

#### Scenario: Validation fails for a missing referenced asset
- **WHEN** the contributor runs `suit validate` against a suit whose manifest references a file that does not exist in the suit directory
- **THEN** the command exits non-zero and reports the missing file path as a validation finding

### Requirement: Inspect a local Suit summary without mutation
The system SHALL implement `suit inspect <path>` to render a human-readable summary of a local Suit's manifest-derived metadata, compatibility, and declared resources without modifying suit files.

#### Scenario: Contributor inspects a valid suit
- **WHEN** the contributor runs `suit inspect` against a valid local suit
- **THEN** the command displays the suit name, version, runtime compatibility, and referenced resource summaries in terminal output

#### Scenario: Inspect surfaces validation findings
- **WHEN** the contributor runs `suit inspect` against a suit with non-fatal findings or warnings
- **THEN** the command includes those findings in the summary instead of silently omitting them

### Requirement: Package only validated local Suits
The system SHALL implement `suit pack <path>` to validate the target suit before packaging and produce a `.suit.tgz` archive named from the suit metadata when validation succeeds.

#### Scenario: Contributor packs a valid suit
- **WHEN** the contributor runs `suit pack` against a valid local suit
- **THEN** the command creates a `<name>-<version>.suit.tgz` archive containing the normalized Suit package contents

#### Scenario: Packing blocks on validation failure
- **WHEN** the contributor runs `suit pack` against a suit that fails validation
- **THEN** the command exits non-zero and does not produce an archive file
