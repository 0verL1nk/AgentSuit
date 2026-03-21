## ADDED Requirements

### Requirement: Runtime host can run a validated local Suit as a single service instance
The system SHALL provide a runtime host that can load a validated local Suit, create one in-process service instance, and keep runtime state isolated to that host instance.

#### Scenario: Contributor starts a valid local Suit service
- **WHEN** the contributor starts the runtime host with a valid local Suit path
- **THEN** the runtime host creates a single service instance associated with that Suit and reports successful startup

### Requirement: Runtime host SHALL expose a health endpoint
The runtime host SHALL expose a health endpoint for liveness checks so contributors and later deployment environments can verify that the service is running.

#### Scenario: Contributor checks service health after startup
- **WHEN** the runtime host has started successfully
- **THEN** an HTTP health endpoint responds with a successful status that indicates the service instance is alive

### Requirement: Runtime host SHALL provide a minimal session lifecycle contract
The runtime host SHALL export runtime-facing contracts for starting a session, sending input, streaming agent events, interrupting a session, and closing a session, even if the first implementation uses a mock in-process engine.

#### Scenario: Contributor creates and closes a runtime session
- **WHEN** a consumer starts a session through the runtime host and then closes it
- **THEN** the runtime host returns a session handle, emits deterministic lifecycle events, and releases the session cleanly

### Requirement: Runtime startup SHALL produce a deterministic serve report
The runtime host SHALL produce a deterministic startup report that identifies the service instance, loaded Suit, listening address, and health endpoint details.

#### Scenario: Contributor inspects startup metadata
- **WHEN** the runtime host starts successfully
- **THEN** it returns a serve report containing instance identity and runtime endpoint information in a deterministic structure
