## MODIFIED Requirements

### Requirement: Exposure plugins SHALL integrate through a dedicated public contract
The system SHALL provide a dedicated public plugin contract package so exposure integrations can consume session lifecycle behavior through explicit runtime-facing interfaces instead of reaching into the host implementation. Exposure plugins SHALL depend only on runtime-managed session APIs and normalized runtime event envelopes, not on provider-specific adapter internals. The public plugin contract SHALL also define a discoverable plugin definition model so the host can validate plugin identity, requirements, capabilities, and configuration contract before creating a plugin instance.

#### Scenario: Contributor implements a future chat or web plugin
- **WHEN** a contributor creates an exposure plugin for chat or web transport
- **THEN** the plugin can depend on a dedicated public contract package and export a discoverable plugin definition without importing runtime-internal modules

#### Scenario: Plugin consumes runtime-owned events from an adapter-backed session
- **WHEN** a plugin subscribes to runtime session events backed by a selected base-agent adapter
- **THEN** it receives runtime-defined normalized events instead of raw provider-specific adapter event shapes

#### Scenario: Host validates a discovered plugin before instantiation
- **WHEN** the host loads a discovered exposure plugin definition
- **THEN** it can inspect plugin metadata, compatibility requirements, declared capabilities, and configuration schema before calling the plugin factory
