## ADDED Requirements

### Requirement: Runtime image SHALL package the serveable AgentSuit runtime
The system SHALL provide a Docker image that packages the existing `suit` CLI and runtime host so a contributor can start the runtime service without installing the Bun workspace on the target machine.

#### Scenario: Contributor builds and starts the runtime image
- **WHEN** the contributor builds the repository Docker image and starts a container from it
- **THEN** the container starts the AgentSuit runtime service successfully instead of failing with missing workspace dependencies or missing CLI entrypoints

### Requirement: Runtime container SHALL define a deterministic single-host filesystem contract
The runtime Docker deployment SHALL reserve `/app/suit` as the Suit mount path and `/app/state` plus `/app/reports` as writable runtime directories so contributors and future integrations can rely on a stable single-container layout.

#### Scenario: Contributor mounts a Suit into the container
- **WHEN** the contributor runs the runtime container with a valid Suit mounted at `/app/suit`
- **THEN** the container loads that Suit successfully and leaves `/app/state` and `/app/reports` available for writable runtime use

### Requirement: Runtime container SHALL be network-reachable and healthcheck-compatible
The runtime Docker deployment SHALL start `suit serve` with a container-reachable listen address, expose a documented application port, and preserve the `/healthz` endpoint so `docker run` port publishing and container health probes can verify service liveness.

#### Scenario: Contributor publishes the runtime port from Docker
- **WHEN** the contributor runs the runtime container with the documented port mapping
- **THEN** an external health request to the published port returns a successful `/healthz` response from the runtime service

### Requirement: Docker deployment guidance SHALL be executable and verified
The repository SHALL provide contributor-facing Docker usage guidance and an automated smoke verification path that demonstrates the documented image build and runtime startup flow.

#### Scenario: Contributor follows the documented Docker workflow
- **WHEN** the contributor follows the documented build and `docker run` commands
- **THEN** the documented workflow succeeds against the same runtime image contract that is covered by automated smoke verification
