## Why

AgentSuit currently stops at the local Suit authoring loop: contributors can scaffold, validate, inspect, and package a Suit, but they still cannot run a Suit-backed service. Without a minimal runtime host, `suit serve`, and stable runtime-facing extension contracts, the repository cannot validate the service-oriented product direction or provide a safe foundation for the later Claude Code adapter and chat integration work.

## What Changes

- Add a new runtime-host MVP that can load a local Suit, start a single in-process service instance, expose a health endpoint, and manage basic session lifecycle behavior through a shared runtime package.
- Add dedicated public contract packages for base-agent adapters and exposure plugins so later integrations can target explicit seams instead of runtime internals.
- Add a `suit serve <path>` CLI command that validates the Suit, starts the runtime host, reports startup details deterministically, and exits non-zero on usage or runtime failures.
- Introduce shared runtime-facing contracts for session events and serve reporting so later adapters and plugins can build on a stable boundary.
- Keep the first implementation dependency-light by using Bun, the Node standard library, and existing workspace packages instead of introducing web frameworks or third-party runtime hosts.

## Capabilities

### New Capabilities
- `runtime-service-mvp`: Run a validated local Suit as a single-instance service with health checks, basic session lifecycle primitives, and deterministic startup reporting.
- `runtime-extensibility-contracts`: Define stable adapter and plugin public contracts that depend on shared runtime-facing session primitives.

### Modified Capabilities
- `cli-foundation`: Extend the top-level command surface and placeholder/implemented behavior rules to include `serve`.

## Impact

- Affected code: `packages/cli`, new `packages/runtime`, new `packages/adapter-api`, new `packages/plugin-api`, shared contract types in workspace packages, and new runtime-facing tests.
- Affected APIs: contributor-facing `suit serve <path>` behavior, runtime session/event/report contracts, adapter/plugin public contracts, and top-level CLI help output.
- Dependencies: no new third-party runtime dependency is planned for this MVP; the implementation should use Bun and the Node standard library.
