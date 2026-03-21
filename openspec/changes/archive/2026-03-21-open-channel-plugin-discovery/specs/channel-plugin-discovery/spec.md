## ADDED Requirements

### Requirement: Channel plugins SHALL be discovered through exported definitions
The system SHALL discover channel or exposure plugins through explicit exported plugin definitions instead of requiring `suit` command code to hardcode each platform implementation. Each discovered definition SHALL declare its exposure kind, adapter key, identity, and instance factory before the host attempts startup.

#### Scenario: Host discovers an official IM plugin module
- **WHEN** the host loads a configured plugin module such as `@agentsuit/plugin-im-chat`
- **THEN** it reads an exported channel plugin definition that identifies the plugin as `im/discord` and can create an exposure plugin instance without the CLI hardcoding Discord-specific imports

### Requirement: Channel plugin discovery SHALL be validated before startup
The system SHALL validate discovered channel plugin definitions before runtime startup, including uniqueness, compatibility requirements, and plugin configuration contract completeness, and SHALL fail before startup when validation fails.

#### Scenario: Two discovered plugins claim the same exposure and adapter key
- **WHEN** the host discovers two plugin definitions that both claim `im/discord`
- **THEN** startup fails deterministically before runtime startup with a contributor-facing conflict error instead of selecting one implicitly

#### Scenario: A discovered plugin is incompatible with the host
- **WHEN** the host loads a plugin definition whose declared `requires` range is incompatible with the running host or plugin API version
- **THEN** startup fails deterministically before plugin instantiation and reports the incompatible plugin requirement

### Requirement: Channel plugin host SHALL own plugin lifecycle and rollback
The system SHALL let the channel plugin host own exposure plugin instantiation, setup, startup, shutdown, and rollback behavior so a failed plugin start does not leave the runtime in a half-started state.

#### Scenario: Plugin startup fails after runtime host boot
- **WHEN** the selected channel plugin instance fails during `start()`
- **THEN** the host stops the affected runtime or already-started plugin instances, reports the failure deterministically, and does not leave the process running in a partially started state
