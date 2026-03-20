## Why

The repository currently contains product design notes but no executable project scaffold, workspace layout, or development tooling. We need a consistent project foundation now so the Agent Suit CLI can be implemented incrementally without reworking package boundaries, scripts, and contributor workflows later.

## What Changes

- Establish a Bun-managed TypeScript monorepo workspace for the Agent Suit CLI project.
- Add shared build, test, lint, and type-check tooling so all packages follow the same development contract.
- Create the initial package layout for CLI, core, schema, adapters, and registry modules.
- Introduce an executable `suit` CLI entrypoint with command registration stubs for the v0.1 command surface.
- Add baseline contributor documentation and example fixture assets needed to verify the workspace boots correctly.

## Capabilities

### New Capabilities
- `workspace-bootstrap`: Define the repository structure, shared toolchain, workspace scripts, and local development conventions required to build Agent Suit.
- `cli-foundation`: Provide the initial `suit` executable, top-level command registration, and package boundaries that future command implementations can extend.

### Modified Capabilities
- None.

## Impact

- Adds root Bun workspace configuration, package manifests, TypeScript configuration, and quality scripts.
- Introduces new package directories under `packages/` and baseline source files for the CLI and supporting modules.
- Establishes the developer entrypoints and fixture data that later extract, validate, pack, and apply work will build on.
