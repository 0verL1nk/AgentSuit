## 1. IM Plugin Package Setup

- [x] 1.1 Create `packages/plugin-im-chat` with the initial package structure, exports, and the minimum Vercel Chat SDK Discord dependencies needed for a Discord-only MVP.
- [x] 1.2 Add plugin configuration parsing for Discord and IM exposure startup, keeping secrets in environment variables instead of Suit content.
- [x] 1.3 Extend `packages/plugin-api` with the minimum contract surface needed for an IM exposure plugin to receive runtime session access and participate in runtime startup/shutdown.

## 2. Discord Runtime Bridge

- [x] 2.1 Implement Discord thread to runtime session mapping in `plugin-im-chat`, using one runtime session per Discord thread.
- [x] 2.2 Implement the runtime text stream bridge so normalized runtime `message.delta` / `message.completed` events stream back to Discord replies.
- [x] 2.3 Implement deterministic failure and cleanup behavior for Discord thread mappings when runtime sessions fail or become invalid.
- [x] 2.4 Implement the supported Discord stop or interrupt path so an explicit stop request routes to runtime `interrupt(sessionId)`.

## 3. CLI And Host Integration

- [x] 3.1 Extend `suit serve` with `--expose im` and `--im-adapter discord`, while preserving the current default serve behavior when IM exposure is not requested.
- [x] 3.2 Add deterministic CLI failure behavior for unsupported IM adapters and missing Discord configuration.
- [x] 3.3 Wire the runtime/plugin host startup so Discord IM exposure can be initialized and shut down cleanly from `suit serve`.

## 4. Tests, Docs, And Verification

- [x] 4.1 Add automated tests for Discord IM plugin behavior covering thread-session reuse, streaming output, explicit stop/interrupt, and failure-path cleanup.
- [x] 4.2 Add CLI integration tests and contributor docs for local and Docker-based Discord IM startup, including required environment variables and configuration failure paths.
- [x] 4.3 Run and record verification for this change, including `bun run check` and the Discord IM plugin focused tests added in this change.
