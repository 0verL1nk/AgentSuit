## Context

AgentSuit already exposes a minimal runtime session contract and separate placeholder packages for `adapter-api`, `adapter-claude-code`, and `plugin-api`, but those boundaries are still shaped like a mock-only MVP. `adapter-api` currently mirrors the runtime session methods almost 1:1, the runtime host assumes an in-process session engine, and plugins only have an implicit promise that runtime events will remain stable.

That is enough for a mock engine, but not enough for a real hosted base agent such as Claude. Before adding the first real adapter, the repository needs a stable contract for adapter discovery, session ownership, capability reporting, and event normalization so that later work can add Claude without forcing `plugin-chat` or other plugins to understand Claude-specific details.

## Goals / Non-Goals

**Goals:**
- Define a public base-agent adapter contract that includes adapter identity, availability detection, capability reporting, and adapter-backed session lifecycle behavior.
- Extend the runtime host contract so a service instance can bind a selected adapter and keep adapter-owned session state behind runtime-managed session APIs.
- Clarify the plugin boundary so exposure plugins depend only on runtime-owned session interfaces and normalized runtime events.
- Add a verification shape for contract tests, runtime integration tests, and failure-path behavior needed before implementing the first real adapter.

**Non-Goals:**
- Implement the Claude Code adapter itself.
- Introduce the Claude Agent SDK or any other external adapter dependency.
- Implement `plugin-chat`, Vercel Chat SDK integration, or any other exposure plugin.
- Finalize long-term memory, hooks, or subagent mapping behavior for all runtimes.

## Decisions

### 1. Treat base-agent adapters as first-class runtime plugins with their own registry
The runtime host should not select adapters through ad hoc imports or CLI conditionals. Instead, it should work against an explicit adapter registry that can register one or more `BaseAgentAdapterDefinition` entries and resolve a selected adapter by name.

This keeps adapter discovery symmetrical with the existing runtime plugin registry direction and creates a stable seam for later `claude-code`, `codex`, and `openclaw` packages.

Alternatives considered:
- Import the Claude adapter directly into runtime: rejected because it would hard-code the first provider into the host and make later adapters harder to add cleanly.
- Leave adapter selection to the CLI only: rejected because runtime still needs its own deterministic binding model for tests and future hosting environments.

### 2. Separate adapter definition metadata from adapter session instances
The public adapter contract should distinguish:
- adapter definition metadata and `detect()` / `createSession()` responsibilities
- per-session adapter handles that own provider session IDs, abort controls, and provider-specific state

This avoids forcing the runtime to treat the adapter as a global singleton with no explicit session boundary.

Alternatives considered:
- Keep the current global method bag: rejected because it hides session ownership and makes interrupt/resume/error handling ambiguous.
- Push all provider state into the runtime host: rejected because it would leak provider details into runtime internals.

### 3. Normalize plugin-facing events at the runtime boundary
Exposure plugins should subscribe only to runtime-defined session events. Adapter-specific provider details can still exist, but they should be wrapped as runtime-owned normalized events or extension payloads so plugins do not depend on Claude-specific message shapes.

Alternatives considered:
- Let plugins consume raw adapter/provider events: rejected because it would couple `plugin-chat` and future plugins to each adapter.
- Hide all provider detail entirely: rejected because some adapter diagnostics and progress data are useful, but they must remain behind runtime-defined event envelopes.

### 4. Preserve the existing SessionApi command model while extending its backing contract
The current `startSession`, `sendInput`, `streamEvents`, `interrupt`, and `closeSession` command model is still the right plugin-facing API. The hardening work should change how runtime satisfies those commands, not force plugins to learn a second session control surface.

Alternatives considered:
- Replace SessionApi with adapter-specific commands now: rejected because it would destabilize the plugin seam before any plugin exists.
- Delay all contract hardening until Claude implementation: rejected because the first adapter would then define the architecture by accident.

## Risks / Trade-offs

- [The contract may become too abstract before a real adapter exists] → Keep the scope limited to the minimum surfaces needed for Claude MVP: registry, session ownership, capability reporting, and normalized events.
- [Runtime event normalization may overfit to one provider] → Keep provider-specific fields behind runtime-defined extension payloads and verify with contract tests instead of Claude-specific assumptions.
- [Changing public contracts may ripple into tests and placeholder packages] → Update contract tests and placeholders in the same change so the repository stays coherent.
- [Deferring concrete Claude SDK details may leave some edge cases unresolved] → Capture only the invariants required before adapter implementation and leave provider-specific behavior to the next change.

## Migration Plan

1. Expand `adapter-api` and `runtime` public types to model adapter definitions, adapter-backed sessions, and normalized runtime events.
2. Update the runtime host and placeholder packages to use the new adapter registration and session-binding model while preserving the existing mock behavior.
3. Update `plugin-api` and tests so plugins depend only on runtime-managed session contracts.
4. Implement the real Claude adapter in a follow-up change against the new contracts.

## Open Questions

- Should runtime extension events be represented as a broader `AgentEvent` union, or as a typed `payload.meta`/`payload.detail` field inside existing event envelopes?
- Do we want adapter capability reporting to include only booleans for MVP, or a richer degraded/native/plugin-backed capability map before Claude implementation?
