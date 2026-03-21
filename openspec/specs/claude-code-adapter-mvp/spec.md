# claude-code-adapter-mvp Specification

## Purpose
TBD - created by archiving change implement-claude-code-adapter-mvp. Update Purpose after archive.
## Requirements
### Requirement: Claude adapter SHALL implement the public base-agent adapter contract
The system SHALL provide a real `claude-code` base-agent adapter package that implements the hardened public adapter contract instead of remaining a placeholder definition.

#### Scenario: Contributor loads the Claude adapter package
- **WHEN** the runtime or a test loads the `claude-code` adapter package
- **THEN** it exposes adapter identity, availability detection, capability reporting, and adapter-session creation behavior through the shared adapter contract

### Requirement: Claude adapter SHALL bridge Claude-backed sessions into the runtime SessionApi
The Claude adapter SHALL create, drive, interrupt, and close Claude-backed sessions while exposing streamed output through runtime-owned normalized event envelopes compatible with the shared runtime SessionApi.

#### Scenario: Contributor sends input through a Claude-backed runtime session
- **WHEN** a runtime session is started with the `claude-code` adapter and the contributor sends text input
- **THEN** the runtime emits normalized session and message events from the Claude-backed session through the shared session event stream

#### Scenario: Contributor interrupts a Claude-backed runtime session
- **WHEN** a contributor interrupts an active runtime session backed by the `claude-code` adapter
- **THEN** the adapter routes the interrupt to Claude and the runtime emits deterministic session termination events through the shared runtime contract

### Requirement: Claude adapter SHALL report deterministic availability failures
The Claude adapter SHALL surface deterministic availability results and startup failures when the Claude execution environment or credentials are unavailable, rather than failing later with opaque runtime errors.

#### Scenario: Contributor selects Claude when Claude is unavailable
- **WHEN** the contributor starts a runtime session or service with `claude-code` selected but the Claude environment is not available
- **THEN** the adapter reports an unavailable status and the runtime fails with a deterministic contributor-facing error

### Requirement: Claude adapter SHALL apply minimum Suit-driven session configuration
The Claude adapter SHALL map the minimum useful Suit configuration into Claude session startup for MVP, including generated prompt/rules input, a selected working directory, and runtime-provided MCP or tool wiring.

#### Scenario: Contributor starts Claude with Suit overlays and runtime MCP tools
- **WHEN** the contributor starts a Claude-backed runtime session from a valid Suit
- **THEN** the adapter uses Suit-derived instructions and runtime-provided MCP/tool configuration when creating the Claude session

