## MODIFIED Requirements

### Requirement: Runtime host can run a validated local Suit as a single service instance
The system SHALL provide a runtime host that can load a validated local Suit, create one in-process service instance, and keep runtime state isolated to that host instance. The runtime host SHALL be able to bind a selected base-agent adapter for that service instance while keeping adapter-owned provider session state encapsulated behind runtime-managed session APIs.

#### Scenario: Contributor starts a valid local Suit service
- **WHEN** the contributor starts the runtime host with a valid local Suit path
- **THEN** the runtime host creates a single service instance associated with that Suit and reports successful startup

#### Scenario: Runtime starts with a selected base-agent adapter
- **WHEN** the runtime host is configured to use a selected registered base-agent adapter
- **THEN** it binds that adapter for the service instance and keeps later runtime sessions isolated from other adapters or service instances

### Requirement: Runtime host SHALL provide a minimal session lifecycle contract
The runtime host SHALL export runtime-facing contracts for starting a session, sending input, streaming agent events, interrupting a session, and closing a session, even if the first implementation uses a mock in-process engine. The same runtime-facing lifecycle SHALL remain valid when sessions are backed by a selected base-agent adapter instead of the mock engine.

#### Scenario: Contributor creates and closes a runtime session
- **WHEN** a consumer starts a session through the runtime host and then closes it
- **THEN** the runtime host returns a session handle, emits deterministic lifecycle events, and releases the session cleanly

#### Scenario: Runtime interrupts an adapter-backed session
- **WHEN** a consumer interrupts a runtime session that is backed by a selected base-agent adapter
- **THEN** the runtime host routes the interrupt through the bound adapter session handle and emits deterministic runtime failure or completion events through the shared session interface

### Requirement: Runtime startup SHALL produce a deterministic serve report
The runtime host SHALL produce a deterministic startup report that identifies the service instance, loaded Suit, listening address, and health endpoint details. When a selected base-agent adapter is bound, the serve report SHALL also identify the adapter chosen for that service instance so plugins and operators can see which provider the runtime is using.

#### Scenario: Contributor inspects startup metadata
- **WHEN** the runtime host starts successfully
- **THEN** it returns a serve report containing instance identity and runtime endpoint information in a deterministic structure

#### Scenario: Contributor inspects adapter binding metadata
- **WHEN** the runtime host starts with a selected base-agent adapter
- **THEN** the serve report identifies the selected adapter alongside the service instance metadata
