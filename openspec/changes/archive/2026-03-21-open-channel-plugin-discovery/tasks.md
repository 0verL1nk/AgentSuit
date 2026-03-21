## 1. Public Contract

- [x] 1.1 Extend `@agentsuit/plugin-api` with discoverable exposure plugin definitions, including identity, expose kind, adapter key, requirements, capabilities, config contract, and factory shape.
- [x] 1.2 Add a host-facing discovery/validation registry API that can register multiple plugin definitions and reject duplicate `expose/adapter` claims deterministically.
- [x] 1.3 Add contract tests for plugin definition discovery, duplicate registration failure, and host compatibility validation semantics.

## 2. Plugin Host Discovery And Validation

- [x] 2.1 Implement a channel/exposure plugin host module that discovers plugin definitions from explicit module sources and validates them before runtime startup.
- [x] 2.2 Implement deterministic failure behavior for incompatible plugin requirements, missing definitions, and invalid plugin config contracts before plugin instantiation.
- [x] 2.3 Implement startup/shutdown orchestration with rollback so a failed plugin `start()` does not leave the runtime or other plugins half-started.

## 3. CLI Integration

- [x] 3.1 Refactor `suit serve` to delegate exposure plugin selection to the plugin host instead of hardcoding platform-specific branches.
- [x] 3.2 Preserve the existing `--expose im --im-adapter <adapter>` contributor flow while resolving `im/<adapter>` through discovered plugin definitions.
- [x] 3.3 Add CLI tests covering discovered plugin startup, missing plugin resolution, and deterministic failure messages for invalid discovery results.

## 4. Discord Migration

- [x] 4.1 Update `packages/plugin-im-chat` to export a discoverable plugin definition and manifest instead of only exposing a Discord-specific factory function.
- [x] 4.2 Migrate the current Discord IM MVP to run through the new plugin host without changing its thread/session isolation, streaming, failure cleanup, or stop semantics.
- [x] 4.3 Add tests proving that multiple Discord threads or DMs remain isolated after the migration and that Discord still boots through the discovered plugin path.

## 5. Docs And Verification

- [x] 5.1 Update contributor docs to explain the new channel plugin discovery model, the controlled discovery boundary, and how official plugins are surfaced without editing `suit` code.
- [x] 5.2 Document how future channel plugins should export definitions and what validation/compatibility metadata they must provide.
- [x] 5.3 Run and record verification for this change, including `bun run lint`, `bun run typecheck`, `bun test`, and `bun run build` or `bun run check`.
