## Context

The repository currently implements only the local Suit workflow in `packages/core`, `packages/schema`, and `packages/cli`. The top-level CLI still treats `serve` as an unimplemented future command, there is no runtime package, and there is no stable runtime-facing contract for session lifecycle, event streaming, or startup reporting. At the same time, the product direction now explicitly includes running `Base Agent + Suit` as a service, so the codebase needs a small but real runtime substrate before any Claude Code adapter or chat gateway can be added safely.

This is cross-cutting work because it introduces new packages, changes contributor-visible CLI behavior, and defines shared contracts that later adapters and plugins will depend on. The change therefore needs enough structure to avoid rework, but it should remain narrow: one in-process runtime host, one health endpoint, one session manager abstraction, explicit extension seams, and deterministic reporting.

## Goals / Non-Goals

**Goals:**
- Add a runtime package that can host a single Suit-backed service instance in-process.
- Define minimal runtime contracts for session lifecycle, agent events, and serve reports.
- Define dedicated public contracts for base-agent adapters and exposure plugins without implementing real integrations yet.
- Implement `suit serve <path>` with deterministic validation, startup, and failure semantics.
- Expose a health endpoint and simple session-manager behavior so later adapters/plugins have a stable host to integrate with.
- Keep the implementation dependency-light and compatible with the existing workspace quality gate.

**Non-Goals:**
- Implement a Claude Code adapter in this change.
- Implement chat/web/A2A/A2UI plugins in this change.
- Add multi-instance orchestration, multi-tenant routing, or container-specific deployment logic.
- Add remote registry behavior, runtime extraction, or apply planning beyond what already exists.
- Introduce a third-party HTTP framework unless Bun/Node primitives prove insufficient during implementation.

## Decisions

### Create dedicated `packages/runtime`, `packages/adapter-api`, and `packages/plugin-api` packages now

The runtime host should live in its own workspace package rather than being bolted onto `packages/core` or `packages/cli`. `core` already owns manifest loading, packaging, and report helpers; mixing runtime lifecycle concerns into that package would blur the boundary between authoring-time and run-time behavior. At the same time, adapter and plugin contracts should live in their own small public packages so future integrations can depend on stable APIs without importing host internals.

Alternatives considered:
- Put runtime code in `packages/core`: smaller diff at first, but it would couple file-oriented workflow logic to service lifecycle concerns.
- Put runtime code directly in `packages/cli`: faster to prototype, but it would make later plugin and adapter reuse much harder.
- Keep adapter/plugin contracts inside `packages/runtime`: initially convenient, but it would encourage consumers to depend on runtime internals rather than explicit public seams.

### Make the first runtime in-process and mock-agent-backed

The first runtime host should not depend on a real base-agent adapter. Instead, it should provide a small in-process `SessionApi` with a mock/default session engine so the service contract, health checks, and CLI behavior can be verified before Claude Code integration arrives.

Alternatives considered:
- Start directly with Claude Code integration: attractive narrative-wise, but it would entangle runtime, adapter, and external environment concerns in one change.
- Build only types without executable behavior: too abstract; the repository needs a real runtime loop to validate the direction.

### Center the MVP on a command-plane plus event-plane `SessionApi`

The runtime contract should use an explicit session model: start a session, send input into it, consume output through a streaming event interface, and then interrupt or close it. This keeps the runtime core general enough for later chat, web, and agent-to-agent consumers while avoiding an overly specific transport abstraction in the MVP.

Alternatives considered:
- Use a single conversation stream abstraction from the start: elegant in some interfaces, but it bakes one interaction style into the host and makes future adapters/plugins harder to compose.
- Keep the mock runtime synchronous and request/response only: too weak; the product direction is stream-oriented and later Claude integration will need event streaming anyway.

### Use Bun/Node HTTP primitives for the MVP health surface

The MVP only needs a health endpoint and perhaps a minimal internal listener to prove the host is live. Introducing Express, Fastify, Hono, or another server framework now would add dependency and migration overhead without proving additional product value.

Alternatives considered:
- Add a web framework now for future plugin work: reasonable later, but premature before the runtime boundary is stable.
- Expose no HTTP endpoint at all: too weak; health checks are part of the contributor-visible runtime contract.

### Define explicit runtime contracts before adapters and plugins exist

The runtime package should export stable types for `SessionApi`, `AgentEvent`, `SessionHandle`, and `ServeReport`, plus the minimal host implementation. `packages/adapter-api` should define the base-agent adapter contract against those runtime types, and `packages/plugin-api` should define the exposure plugin contract against the same shared session primitives. This gives the upcoming Claude Code adapter and chat plugin work stable seams and avoids ad hoc event shapes leaking out of the host.

Alternatives considered:
- Let each future adapter define its own event shapes: would quickly fragment runtime behavior and make plugin development much harder.
- Keep contracts internal until the first adapter arrives: likely to cause rework, because the adapter would end up defining the host API by accident.

### Keep `suit serve` deterministic and script-friendly

Like the existing local workflow commands, `suit serve` should validate input first, return non-zero for usage or runtime failures, write diagnostics to stderr, and print startup details to stdout only when startup succeeds. Long-running behavior should still preserve scriptability by making startup success/failure unambiguous.

Alternatives considered:
- Make `serve` interactive by default: inconsistent with the repository's non-interactive CLI standards.
- Treat runtime startup as best-effort with warnings: unsafe; startup failure should be explicit.

## Risks / Trade-offs

- [The mock runtime may feel throwaway] → Keep the contracts stable and the host realistic enough that the Claude adapter can plug into the same seams later.
- [The new API packages may still change quickly] → Keep their first surface area intentionally tiny and centered on the agreed `SessionApi` rather than speculative future capabilities.
- [A too-minimal health surface may need refactoring later] → Limit the MVP to `/healthz` and a concise serve report so later expansion is additive.
- [Long-running CLI commands can be awkward to test] → Design the runtime host with start/stop primitives and keep the CLI wrapper thin so package-level tests can verify most behavior without brittle process orchestration.
- [Adding a new package increases workspace surface area] → Keep the new package small, dependency-light, and covered by focused unit/integration tests.

## Migration Plan

1. Add `packages/runtime` with runtime contracts and an in-process host/session manager.
2. Add `packages/adapter-api` and `packages/plugin-api` with minimal public contracts that depend only on shared runtime-facing types.
3. Extend CLI command registration and help output to include a real `serve` implementation.
4. Add runtime and CLI tests covering startup success, validation failure, missing-argument failure, health endpoint behavior, and public contract exports.
5. Update README and related docs to mention the new runtime MVP entrypoint once tests pass.

Rollback is straightforward because this change is additive: remove the runtime package and revert `serve` back to placeholder behavior if the MVP proves insufficient.

## Open Questions

- Should the MVP health endpoint bind by default to `127.0.0.1` or `0.0.0.0` for contributor ergonomics?
- Should `serve-report.json` be written only when explicitly requested, or always emitted to a default state directory for the MVP?
- Do we want a dry-run or no-listen mode in the MVP, or can that wait until adapter/plugin work begins?
