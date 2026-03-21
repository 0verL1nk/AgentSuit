## Why

The runtime MVP can already serve a validated local Suit, but it is still a workspace-only developer flow and not yet a deployable service artifact. Shipping a single-host Docker path now validates the product's cloud-facing delivery model before we add real adapters such as Claude Code or chat/web exposure plugins.

## What Changes

- Add a Docker deployment MVP for the existing runtime host so contributors can package and run `suit serve` inside a single container.
- Define the minimum container contract for image layout, mounted Suit content, persisted state/report directories, exposed port, and healthcheck compatibility.
- Add contributor-facing documentation and smoke-test coverage for building and running the runtime image with `docker run`, without requiring Docker Compose.

## Capabilities

### New Capabilities
- `runtime-docker-deploy-mvp`: Defines the minimum requirements for packaging and running the AgentSuit runtime host as a single-container Docker service.

### Modified Capabilities
- None.

## Impact

- Affected code: CLI/runtime packaging, repository-level Docker assets, Docker-oriented verification, and runtime deployment documentation.
- APIs/systems: Container startup conventions for `suit serve`, deterministic mount points for Suit and runtime data, and health probing from outside the container.
- Dependencies: Requires Docker-compatible image assets and local smoke verification, but does not require new application runtime libraries beyond the existing Bun workspace.
