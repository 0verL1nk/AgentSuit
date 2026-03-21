## Why

The runtime host and adapter contracts are now strong enough to bind a real external base agent, but AgentSuit still cannot run any non-mock adapter end to end. Implementing the first real adapter with Claude now validates the runtime architecture, the session bridge, and the contributor workflow that later `plugin-chat` and Vercel Chat SDK integration will depend on.

## What Changes

- Add the first real base-agent adapter in `packages/adapter-claude-code`, implemented against the Claude Agent SDK rather than leaving the package as a placeholder.
- Extend `suit serve` so contributors can explicitly select `claude-code` as the base agent and receive deterministic startup or failure behavior when Claude is unavailable.
- Map the minimum useful Suit inputs into Claude session startup for MVP: prompt/rules injection, selected session working directory, and MCP/tool wiring needed by the runtime bridge.
- Add automated tests and contributor docs that prove Claude-backed runtime sessions can start, stream output, interrupt cleanly, and fail predictably when the Claude environment is unavailable.

## Capabilities

### New Capabilities
- `claude-code-adapter-mvp`: Defines the minimum behavior for a real Claude-backed base-agent adapter that can be selected by the runtime host and bridged through the shared runtime session API.

### Modified Capabilities
- `cli-foundation`: Extend `suit serve` with explicit base-agent selection and deterministic contributor-facing failure semantics for unavailable adapters.

## Impact

- Affected code: `packages/adapter-claude-code`, `packages/runtime`, `packages/cli`, runtime/adapter tests, and contributor docs.
- APIs/systems: runtime adapter binding, `suit serve` option parsing, runtime event normalization for Claude-backed sessions, and local or Docker-based runtime invocation.
- Dependencies: introduces the Claude Agent SDK as the first real external base-agent dependency because the placeholder adapter cannot provide session creation, streaming, interrupt, or resume behavior by itself.
