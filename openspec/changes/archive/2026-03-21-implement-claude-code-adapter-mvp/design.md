## Context

AgentSuit now has a runtime host that can bind selected base-agent adapters through a hardened adapter contract, but the only working adapter is still the in-process mock path. The next step is to replace one placeholder package with a real adapter so the runtime architecture is validated against an external provider before `plugin-chat` or Vercel Chat SDK integration begins.

Claude is the right first target because the repository already treats `claude-code` as a supported runtime, the adapter research in `docs/adapter_适配调研.md` identifies Claude as the most complete native fit, and Anthropic now exposes the Claude Agent SDK for hosted session control. This change touches the adapter package, runtime/CLI integration, contributor docs, and test strategy, but should stay narrowly scoped to a single real provider and a single runtime entrypoint.

## Goals / Non-Goals

**Goals:**
- Implement the first real base-agent adapter in `packages/adapter-claude-code`.
- Let contributors select `claude-code` from `suit serve` with deterministic startup and failure behavior.
- Bridge a Claude-backed session into the existing runtime `SessionApi`, including start, send, stream, interrupt, and close behavior.
- Map the minimum useful Suit inputs into Claude session setup for MVP: prompt/rules injection, working directory selection, and MCP/tool wiring.
- Add automated verification that does not require live Claude credentials in the default quality gate.

**Non-Goals:**
- Implement `plugin-chat`, Vercel Chat SDK transport, or any web/chat exposure surface.
- Implement full AgentSuit memory, hooks, or subagent orchestration on top of Claude.
- Add Codex or OpenClaw runtime adapters in the same change.
- Require live Claude credentials in `bun run check`.

## Decisions

### 1. Use the Claude Agent SDK as the adapter implementation boundary
The adapter should target Anthropic's Claude Agent SDK instead of wrapping raw `claude -p` process calls as the primary implementation path. The SDK gives the repository a programmatic session API with resume, interrupt, MCP injection, and structured streamed messages, which fits the hardened runtime adapter contract better than shelling out to CLI text streams.

Alternatives considered:
- Raw CLI process wrapping: simpler at first, but weaker for session ownership, resume, and structured event mapping.
- Delay the adapter until a plugin exists: rejected because the adapter/runtime bridge should be validated before adding transports.

### 2. Keep Claude session setup minimal and project-scoped for MVP
The adapter should only map the minimum inputs needed to prove the architecture:
- generated Claude instructions from Suit prompt overlays
- a selected working directory for the adapter session
- runtime-provided MCP/tool configuration

It should not attempt to fully model long-term memory, hooks, or subagents yet.

Alternatives considered:
- Full native Claude feature mapping up front: rejected because it would expand scope too far before the base session bridge is proven.
- No Suit injection at all: rejected because the adapter would not demonstrate that Suit content actually influences Claude sessions.

### 3. Expose Claude selection through `suit serve --base-agent`
The contributor-facing runtime entrypoint should remain `suit serve`, with an explicit `--base-agent <name>` option for selecting `claude-code`. This keeps the workflow aligned with the later runtime service shape and avoids inventing a parallel adapter-only command surface.

Alternatives considered:
- Reuse internal `adapterName` terminology on the CLI: rejected because `base-agent` is the clearer product-facing term.
- Require programmatic runtime usage only: rejected because contributors need a scriptable terminal workflow first.

### 4. Use mocked SDK seams for automated tests and document live smoke separately
The default quality gate should use mocked Claude SDK behavior in tests so `bun run check` remains deterministic and credential-free. Contributor docs can still describe an opt-in live smoke workflow for environments that have Claude credentials configured.

Alternatives considered:
- Make live Claude calls part of the default test suite: rejected because credentials and network availability would destabilize the local quality gate.
- Skip adapter behavior tests entirely: rejected because the first real adapter must be covered by automated regression checks.

## Risks / Trade-offs

- [Claude Agent SDK behavior may evolve faster than the runtime contract] → Isolate it behind a small adapter-internal facade and keep runtime/plugin surfaces provider-agnostic.
- [Suit-to-Claude injection may overfit to Claude-specific conventions] → Limit MVP injection to prompt/rules and MCP wiring, and treat richer native features as follow-up work.
- [CLI flag choice may need refinement later] → Keep `--base-agent` narrow and deterministic so it can be extended without breaking the base serve workflow.
- [Mocked tests might miss integration issues with live credentials] → Document an opt-in live smoke path and keep adapter internals separated enough to add integration tests later.

## Migration Plan

1. Add the Claude Agent SDK dependency and an adapter-internal facade in `packages/adapter-claude-code`.
2. Implement the Claude adapter definition and session bridge against the hardened runtime contract.
3. Extend `suit serve` to accept `--base-agent claude-code`, register the Claude adapter, and surface deterministic failures.
4. Add tests and docs, then run the normal quality gate.

## Open Questions

- Should the MVP Claude adapter write generated instructions into a temporary working directory only, or support in-place project file generation from the start?
- Do we want a separate optional live smoke command in this change, or only documented manual commands for credentialed environments?
