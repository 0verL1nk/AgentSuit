## 1. Runtime Image Packaging

- [x] 1.1 Add repository Docker assets that build a runnable AgentSuit runtime image from the Bun workspace and package the `suit` CLI entrypoint.
- [x] 1.2 Implement the container startup contract so the image serves `/app/suit` on a container-reachable host/port and prepares `/app/state` plus `/app/reports` for runtime writes.
- [x] 1.3 Verify the failure path for missing or invalid mounted Suit content so container startup exits deterministically instead of hanging or masking the error.

## 2. Docker Workflow Documentation

- [x] 2.1 Document the canonical Docker build and `docker run` workflow, including published port usage and the `/app/suit`, `/app/state`, and `/app/reports` mount conventions.
- [x] 2.2 Document how contributors can override the default container command for advanced runtime scenarios without Docker Compose.

## 3. Smoke Verification

- [x] 3.1 Add an automated Docker smoke verification path that builds the runtime image, starts a container with an example Suit mounted in, and checks the published `/healthz` endpoint.
- [x] 3.2 Add automated coverage for the documented failure path when the container is started without a valid Suit mount.
- [x] 3.3 Run and record the required verification commands for this change, including `bun run check` and the Docker smoke verification workflow.
