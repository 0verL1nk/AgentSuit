## Context

AgentSuit now has a runtime MVP that can load a local Suit and expose a minimal HTTP health endpoint through `suit serve`, but contributors still need a checked-out workspace plus Bun to run it. The next step is to package that existing runtime into a single-host Docker artifact so the service model is testable before we wire in Claude Code adapters or chat/web plugins.

This change touches multiple layers: repository packaging, CLI/runtime startup conventions, contributor documentation, and automated verification. The user preference is explicit: single-machine Docker first, `docker run` first, no Compose dependency, and no control-plane work in this iteration.

## Goals / Non-Goals

**Goals:**
- Produce one Docker image that can run the current runtime host without a local Bun workspace on the target machine.
- Standardize the first container contract for mounted Suit content and writable runtime directories.
- Make the container reachable from outside the host machine and compatible with Docker health probing.
- Add a smoke verification path that proves the image builds and starts the runtime successfully.

**Non-Goals:**
- Implement a real Claude Code adapter or any other base-agent adapter.
- Implement `plugin-chat`, Vercel Chat SDK transport, A2A, or A2UI exposure paths.
- Introduce Docker Compose, Kubernetes manifests, or multi-container orchestration.
- Design multi-tenant persistence, authentication, or production hardening beyond the MVP container contract.

## Decisions

### 1. Ship a dedicated runtime image from the monorepo workspace
The image should be built from the current repository so it packages the existing `suit` CLI and runtime packages together. This keeps the Docker path aligned with the verified workspace code instead of creating a separate distribution flow.

Alternatives considered:
- Publish a separate prebuilt binary first: rejected because the repository does not yet have a mature release pipeline for standalone binaries.
- Build an image around ad hoc source copies: rejected because it would drift from the Bun workspace layout and complicate testing.

### 2. Define a fixed first-pass container filesystem contract
The image should reserve:
- `/app/suit` for the mounted Suit payload, typically read-only
- `/app/state` for writable runtime state
- `/app/reports` for writable runtime reports or diagnostics

Fixed paths reduce ambiguity in docs, smoke tests, and future plugins/adapters. We can add configurability later once real adapters clarify what must persist.

Alternatives considered:
- Make all paths configurable up front: rejected because it adds flags and environment surface before we know which options are necessary.
- Reuse arbitrary host paths only through custom commands: rejected because it weakens the one-command Docker contract the user wants.

### 3. Default the container to a network-reachable `suit serve` invocation
The image should default to serving `/app/suit` on `0.0.0.0:8080`, exposing a health endpoint at `/healthz`. This gives a predictable `docker run -p 8080:8080 ...` path while still allowing advanced users to override the container command if needed.

Alternatives considered:
- Keep the current default host `127.0.0.1`: rejected because it would not be reachable through Docker port publishing.
- Require every `docker run` invocation to pass the full serve command: rejected because the MVP should be runnable with a minimal canonical command.

### 4. Verify Docker behavior with an end-to-end smoke test, not unit tests alone
The change should include a Docker smoke test that builds the image, starts a container with an example Suit mounted in, and verifies `/healthz` from outside the container. That test covers the actual delivery path that unit tests cannot.

Alternatives considered:
- Only add documentation: rejected because deployability claims need executable verification.
- Only unit test the Docker command string: rejected because it would miss image build and network binding failures.

## Risks / Trade-offs

- [Docker is not available in every contributor environment] → Make the smoke path optional/documented for local use, while keeping the rest of the workspace test suite independent of Docker.
- [A fixed `/app/*` contract may be too narrow for later adapters] → Treat these paths as MVP conventions and revisit them when adapter/plugin requirements become concrete.
- [Bundling the whole workspace into an image may increase build time] → Keep the image focused on the CLI/runtime execution path and defer aggressive image optimization until the runtime surface stabilizes.
- [Default container startup can hide configuration needs] → Document the default contract clearly and allow command override for advanced cases.

## Migration Plan

1. Add repository Docker assets and runtime container startup defaults.
2. Document the canonical build and `docker run` commands, including mount expectations and published ports.
3. Add a Docker smoke verification path and run it in contributor validation where Docker is available.
4. Roll back by reverting the Docker assets and docs; the existing local `suit serve` workflow remains unchanged.

## Open Questions

- Should the MVP image expose runtime configuration through environment variables immediately, or stay command-only until adapter needs are clearer?
- Do we want the smoke test wired into the default `bun run check` path now, or as a separate opt-in verification command because Docker availability varies by machine?
