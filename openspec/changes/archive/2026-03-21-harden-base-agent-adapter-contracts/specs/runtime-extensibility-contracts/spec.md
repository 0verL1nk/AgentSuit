## MODIFIED Requirements

### Requirement: Base-agent adapters SHALL integrate through a dedicated public contract
The system SHALL provide a dedicated public adapter contract package so base-agent integrations can depend on stable runtime-facing interfaces without importing runtime host internals directly. That public contract SHALL define adapter identity, availability detection, capability reporting, adapter-session creation, and adapter-backed session control boundaries instead of only mirroring the runtime session methods as a flat global method bag.

#### Scenario: Contributor implements a future base-agent adapter
- **WHEN** a contributor creates an adapter for a future base agent such as Claude Code
- **THEN** the adapter can implement a dedicated public contract that is published separately from the runtime host package

#### Scenario: Runtime binds a selected adapter through the public contract
- **WHEN** the runtime host loads a selected base-agent adapter
- **THEN** it can discover adapter metadata, detect whether the adapter is available, create adapter-backed session handles, and keep provider-specific session state behind the public contract

### Requirement: Exposure plugins SHALL integrate through a dedicated public contract
The system SHALL provide a dedicated public plugin contract package so exposure integrations can consume session lifecycle behavior through explicit runtime-facing interfaces instead of reaching into the host implementation. Exposure plugins SHALL depend only on runtime-managed session APIs and normalized runtime event envelopes, not on provider-specific adapter internals.

#### Scenario: Contributor implements a future chat or web plugin
- **WHEN** a contributor creates an exposure plugin for chat or web transport
- **THEN** the plugin can depend on a dedicated public contract package and the shared session interfaces without importing runtime-internal modules

#### Scenario: Plugin consumes runtime-owned events from an adapter-backed session
- **WHEN** a plugin subscribes to runtime session events backed by a selected base-agent adapter
- **THEN** it receives runtime-defined normalized events instead of raw provider-specific adapter event shapes

### Requirement: Session lifecycle SHALL be modeled as commands plus streaming events
The shared runtime-facing contracts SHALL define session lifecycle through explicit commands to start, send input, interrupt, and close sessions, while delivering agent output through a streaming event interface. That model SHALL remain stable even when the runtime session is backed by an external adapter, and the event interface SHALL support runtime-defined extension metadata without exposing adapter-private transport details directly to plugins.

#### Scenario: Contributor consumes the shared runtime contract
- **WHEN** a consumer uses the runtime-facing session interfaces
- **THEN** session control occurs through command methods and agent output is observed through a streaming event interface

#### Scenario: Adapter-backed session emits normalized progress
- **WHEN** an external base-agent adapter produces provider progress or message output during a runtime session
- **THEN** the runtime exposes that output through the shared streaming event interface using runtime-defined event envelopes and extension metadata
