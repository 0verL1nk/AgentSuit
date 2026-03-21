# im-chat-plugin-mvp Specification

## Purpose
TBD - created by archiving change implement-discord-im-plugin-mvp. Update Purpose after archive.
## Requirements
### Requirement: Discord IM plugin SHALL bridge Discord threads into runtime sessions
The system SHALL provide a `plugin-im-chat` package that uses Discord as the first supported IM platform and binds Discord conversation threads to AgentSuit runtime sessions instead of talking to provider-specific sessions directly.

#### Scenario: Contributor enables Discord IM exposure
- **WHEN** the contributor starts the runtime with Discord IM exposure enabled and valid Discord configuration
- **THEN** the system initializes the Discord-backed IM plugin and routes Discord thread events through the shared runtime session API

### Requirement: Discord IM plugin SHALL reuse a runtime session per Discord thread
The Discord IM plugin SHALL create a runtime session for a Discord thread on first routed interaction and SHALL reuse that same runtime session for later subscribed messages in the same thread until the session is explicitly cleared or fails.

#### Scenario: Contributor continues a Discord thread conversation
- **WHEN** a Discord thread that already has a runtime session receives a later routed message
- **THEN** the plugin sends that message to the existing runtime session instead of creating a second session for the same thread

### Requirement: Discord IM plugin SHALL stream runtime text output back to Discord
The Discord IM plugin SHALL translate normalized runtime text events into Discord-visible streamed replies so contributors receive incremental assistant output instead of waiting only for a final message.

#### Scenario: Runtime emits streamed text for a Discord request
- **WHEN** the runtime session emits `message.delta` and `message.completed` events while handling a Discord thread input
- **THEN** the plugin streams the assistant text back through the Discord thread and marks the reply complete when the runtime message completes

### Requirement: Discord IM plugin SHALL surface deterministic failures and interrupt behavior
The Discord IM plugin SHALL report runtime or platform failures back to the Discord thread with deterministic contributor-facing behavior, and SHALL route explicit stop or interrupt actions through the runtime session API rather than silently dropping the stream.

#### Scenario: Runtime session fails while serving a Discord thread
- **WHEN** the runtime emits a `session.failed` event for the mapped Discord thread
- **THEN** the plugin posts a deterministic failure reply and clears or invalidates the thread-to-session mapping

#### Scenario: Contributor triggers an explicit stop path
- **WHEN** the contributor invokes the supported Discord stop or interrupt path for an active thread
- **THEN** the plugin calls runtime `interrupt(sessionId)` and the active thread stops receiving further assistant output for that interrupted turn

