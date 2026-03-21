## ADDED Requirements

### Requirement: New or modified CLI commands MUST be self-explanatory
New or modified `suit` CLI commands SHALL provide a predictable help experience so contributors can understand usage without reading source code.

#### Scenario: Contributor asks for top-level help
- **WHEN** the contributor runs `suit --help`
- **THEN** the CLI displays the command surface, a short purpose statement, and enough context to discover the next valid command

#### Scenario: Contributor asks for command-specific guidance
- **WHEN** a contributor runs help for a specific implemented command or invokes it with missing required arguments
- **THEN** the CLI responds with the command's expected arguments, supported options, and an actionable correction instead of a vague failure

### Requirement: New or modified CLI commands MUST preserve scriptable behavior
New or modified `suit` CLI commands SHALL remain composable in non-interactive shells by separating human-facing diagnostics from command results and by avoiding unnecessary prompts.

#### Scenario: Contributor runs a command in automation
- **WHEN** a contributor invokes a non-interactive command from CI, a shell script, or a pipe-based workflow
- **THEN** the command completes without requiring terminal prompts unless an explicit interactive mode was requested

#### Scenario: Contributor consumes command output programmatically
- **WHEN** a command emits operational output and validation or error information in the same invocation
- **THEN** the command keeps the success payload readable from standard output and writes diagnostics to standard error

### Requirement: New or modified CLI commands MUST use deterministic exit semantics
New or modified `suit` CLI commands SHALL return exit codes and terminal messages that let contributors distinguish success, usage errors, validation failures, and unexpected runtime failures.

#### Scenario: Contributor provides invalid command input
- **WHEN** a contributor passes an unknown command, omits a required argument, or provides malformed option values
- **THEN** the CLI exits non-zero and reports a deterministic usage-oriented error message

#### Scenario: Contributor hits a domain validation failure
- **WHEN** a command completes execution but the target Suit or input data fails domain validation
- **THEN** the CLI exits non-zero and reports the validation findings without masking them as an internal crash

#### Scenario: Contributor hits an unexpected internal failure
- **WHEN** a command encounters an unhandled I/O, archive, or runtime exception
- **THEN** the CLI exits non-zero and reports a concise operator-facing failure message without pretending the operation succeeded

### Requirement: New or modified file-oriented commands MUST be cross-platform and path-safe
New or modified `suit` CLI commands that read or write workspace files SHALL use repository-relative or user-provided paths safely across supported operating systems and SHALL avoid assumptions tied to one shell environment.

#### Scenario: Contributor passes a relative workspace path
- **WHEN** a contributor runs a file-oriented command with a relative path from the current working directory
- **THEN** the command resolves the target deterministically and reports errors with the resolved or user-meaningful path

#### Scenario: Contributor runs on a different operating system
- **WHEN** a contributor runs the same command on macOS, Linux, or Windows-compatible environments
- **THEN** the command behavior does not depend on hard-coded path separators, shell-specific quoting rules, or platform-specific temporary file locations

### Requirement: New or modified CLI features MUST minimize operational and supply-chain risk
New or modified `suit` CLI features SHALL prefer the platform standard library and existing workspace packages before adding third-party dependencies, and SHALL validate untrusted filesystem or archive input before use.

#### Scenario: Contributor proposes a new external dependency
- **WHEN** a change introduces a third-party runtime dependency for CLI behavior
- **THEN** the change documents why built-in Bun, Node, or existing workspace capabilities were insufficient and keeps the dependency set no larger than necessary

#### Scenario: Contributor processes untrusted local artifacts
- **WHEN** a command reads manifests, archives, or referenced files that may come from outside the repository
- **THEN** the command validates structure and paths before mutation, packaging, extraction, or execution-oriented follow-up work

### Requirement: New or modified CLI behavior MUST ship with verification coverage
New or modified `suit` CLI behavior SHALL include automated verification that exercises the contributor-visible contract and SHALL remain compatible with the repository quality gate.

#### Scenario: Contributor changes terminal-facing command behavior
- **WHEN** a change alters command parsing, output, validation, packaging, or filesystem side effects
- **THEN** the change adds or updates automated tests covering the success path and at least one failure path for the affected behavior

#### Scenario: Contributor prepares the change for merge
- **WHEN** the contributor runs the repository verification flow for the affected CLI work
- **THEN** the change passes the workspace quality gate for linting, typechecking, tests, and build before it is considered ready
