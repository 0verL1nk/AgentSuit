## Why

The repository already has placeholder packages for `adapter-api`, `adapter-claude-code`, and `plugin-api`, but the current contracts are still too thin to host a real external base agent such as Claude. Hardening the adapter/runtime contracts now reduces rework before we implement the first real adapter and keeps `plugin-chat` isolated from provider-specific details.

## What Changes

- Expand the public base-agent adapter contract beyond a raw session-method mirror so adapters can declare availability, capabilities, session state needs, and normalized event behavior.
- Define how the runtime host discovers and binds a selected base-agent adapter instead of assuming only the in-process mock engine.
- Tighten the plugin boundary so exposure plugins consume only runtime-owned session interfaces and normalized runtime events, not provider-specific adapter internals.
- Add contributor-facing verification expectations for adapter contract tests, runtime integration tests, and failure-path handling before the first Claude adapter is implemented.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `runtime-extensibility-contracts`: Strengthen the public adapter and plugin contracts with explicit adapter lifecycle, capability reporting, and event normalization boundaries.
- `runtime-service-mvp`: Extend the runtime-host requirements so runtime sessions can be backed by a selected base-agent adapter instead of only the mock in-process engine.

## Impact

- Affected code: `packages/adapter-api`, `packages/runtime`, `packages/plugin-api`, adapter package bootstraps, and runtime-focused tests.
- APIs/systems: public adapter contract shape, runtime session/event model, adapter registration/discovery, and plugin-facing runtime boundaries.
- Dependencies: no new external runtime dependency is required in this change; it prepares the repository for later Claude Agent SDK integration without coupling this contract work to that SDK yet.
