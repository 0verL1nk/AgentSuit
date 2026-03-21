## Why

The repository currently has only a scaffolded CLI surface and a minimal suit fixture, so contributors still cannot exercise any real Agent Suit workflow locally. We need a first executable inner loop now that proves the manifest format, local asset structure, validation, human-readable inspection, and packaging behavior before tackling runtime extraction or cross-runtime apply.

## What Changes

- Implement `suit new <name>` to generate a standard local Suit directory scaffold with a minimal manifest, README, and asset folders.
- Implement `suit validate <path>` to parse `suit.yaml`, verify required fields, confirm referenced assets exist, and emit a deterministic validation report.
- Implement `suit inspect <path>` to render a readable summary of suit metadata, compatibility, and declared resources without mutating the suit.
- Implement `suit pack <path>` to validate a local suit and package it into the documented `.suit.tgz` archive format.
- Add core schema, parsing, validation, reporting, and packaging primitives needed by these commands.
- Expand tests and fixtures so the local authoring workflow is exercised end-to-end from the CLI.

## Capabilities

### New Capabilities
- `local-suit-workflow`: Define the first real local authoring loop for creating, validating, inspecting, and packaging a portable Suit from a workspace directory.

### Modified Capabilities
- `cli-foundation`: Update the CLI command behavior contract so implemented commands can succeed while unimplemented commands continue to fail with a deterministic placeholder error.

## Impact

- Affects `packages/cli`, `packages/core`, and `packages/schema` with the first non-placeholder command logic and shared Suit model handling.
- Adds or updates example fixtures and CLI/core tests for local Suit creation, validation, inspection, and packaging.
- Establishes the local contract that later `extract`, `pull`, `publish`, and `apply` changes will build on.
