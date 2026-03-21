## ADDED Requirements

### Requirement: Base-agent adapters SHALL integrate through a dedicated public contract
The system SHALL provide a dedicated public adapter contract package so base-agent integrations can depend on stable runtime-facing interfaces without importing runtime host internals directly.

#### Scenario: Contributor implements a future base-agent adapter
- **WHEN** a contributor creates an adapter for a future base agent such as Claude Code
- **THEN** the adapter can implement a dedicated public contract that is published separately from the runtime host package

### Requirement: Exposure plugins SHALL integrate through a dedicated public contract
The system SHALL provide a dedicated public plugin contract package so exposure integrations can consume session lifecycle behavior through explicit runtime-facing interfaces instead of reaching into the host implementation.

#### Scenario: Contributor implements a future chat or web plugin
- **WHEN** a contributor creates an exposure plugin for chat or web transport
- **THEN** the plugin can depend on a dedicated public contract package and the shared session interfaces without importing runtime-internal modules

### Requirement: Session lifecycle SHALL be modeled as commands plus streaming events
The shared runtime-facing contracts SHALL define session lifecycle through explicit commands to start, send input, interrupt, and close sessions, while delivering agent output through a streaming event interface.

#### Scenario: Contributor consumes the shared runtime contract
- **WHEN** a consumer uses the runtime-facing session interfaces
- **THEN** session control occurs through command methods and agent output is observed through a streaming event interface
