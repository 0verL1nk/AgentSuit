## 1. Runtime Contracts

- [x] 1.1 Create `packages/runtime` with exported runtime contracts for `SessionApi`, `AgentEvent`, `SessionHandle`, and `ServeReport`
- [x] 1.2 Create `packages/adapter-api` and `packages/plugin-api` with minimal public contracts that depend only on the shared runtime-facing types
- [x] 1.3 Implement an in-process runtime host and mock session engine that can load a validated Suit and manage a single service instance
- [x] 1.4 Add a minimal health endpoint implementation and runtime start/stop primitives without introducing unnecessary third-party dependencies

## 2. CLI Serve Command

- [x] 2.1 Extend the CLI command surface and help output to include `serve` as an implemented command
- [x] 2.2 Implement `suit serve <path>` argument parsing, Suit validation, runtime startup, and deterministic stdout/stderr behavior
- [x] 2.3 Implement failure-path behavior for missing required arguments, invalid Suit input, and runtime startup errors so `serve` exits non-zero predictably

## 3. Verification

- [x] 3.1 Add package-level tests for runtime startup, health endpoint behavior, session lifecycle events, serve report generation, and public contract exports
- [x] 3.2 Add CLI tests covering `serve` success, usage failure, and validation failure paths
- [x] 3.3 Update README or related contributor docs for the new runtime MVP entrypoint
- [x] 3.4 Run and verify `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build`
