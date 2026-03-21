## 1. Claude Adapter Package

- [x] 1.1 Add the Claude Agent SDK dependency and adapter-internal facade needed for `packages/adapter-claude-code` to create and manage Claude-backed sessions.
- [x] 1.2 Implement the `claude-code` adapter definition with deterministic `detect()` behavior, capability reporting, session creation, streamed event normalization, interrupt support, and clean session shutdown.
- [x] 1.3 Implement the minimum Suit-to-Claude session setup for MVP, including Suit-derived instructions, working directory selection, and runtime-provided MCP/tool wiring.

## 2. Runtime And CLI Integration

- [x] 2.1 Register the Claude adapter with the runtime host and ensure runtime startup metadata identifies `claude-code` when selected.
- [x] 2.2 Extend `suit serve` with `--base-agent <name>` selection while preserving the current default mock runtime behavior when no base agent is specified.
- [x] 2.3 Add deterministic failure-path behavior for unknown or unavailable selected base agents so `suit serve` reports clear contributor-facing errors.

## 3. Tests, Docs, And Verification

- [x] 3.1 Add automated tests for the Claude adapter bridge using mocked Claude SDK seams, covering detect, session startup, streamed output, interrupt, and failure behavior.
- [x] 3.2 Add CLI or runtime integration tests plus contributor docs for local and Docker-based Claude adapter usage, including any required Claude environment prerequisites and optional live smoke steps.
- [x] 3.3 Run and record verification for this change, including `bun run check` and the Claude-adapter-focused automated tests added in this change.
