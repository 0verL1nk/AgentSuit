## 1. Public Contract Hardening

- [x] 1.1 Expand `packages/adapter-api` to model adapter definitions, availability detection, capability reporting, and adapter-backed session handles instead of only a flat session method mirror.
- [x] 1.2 Update `packages/runtime` public types so runtime session events can carry normalized adapter-backed metadata while preserving the existing SessionApi command surface.
- [x] 1.3 Update `packages/plugin-api` so exposure plugins explicitly depend on runtime-owned session interfaces and normalized runtime event envelopes rather than adapter internals.

## 2. Runtime Binding Model

- [x] 2.1 Add a runtime-facing adapter registry and adapter selection model so the runtime host can bind a selected base-agent adapter for a service instance.
- [x] 2.2 Refactor the mock runtime path to run through the same adapter-backed session flow that future real adapters will use.
- [x] 2.3 Add deterministic failure-path behavior for unknown adapters, unavailable adapters, or adapter session startup failures so runtime callers receive clear runtime-owned errors.

## 3. Placeholder Packages And Tests

- [x] 3.1 Update placeholder adapter packages and runtime/plugin contract helpers to conform to the hardened public contracts.
- [x] 3.2 Add or update contract tests that verify adapter registration, adapter-backed session lifecycle behavior, normalized event delivery, and plugin isolation from provider-specific details.
- [x] 3.3 Run and record verification for this change, including `bun run check` and the adapter/runtime-focused test coverage added for the hardened contracts.
