## 1. Schema And Core Foundations

- [x] 1.1 Define the minimal Suit manifest types, enums, and validation result shapes in `packages/schema`.
- [x] 1.2 Implement shared core helpers to load a suit directory, parse `suit.yaml`, resolve referenced local files, and return deterministic validation findings.
- [x] 1.3 Implement scaffold-generation helpers in `packages/core` that create a minimal suit structure matching the first manifest contract.
- [x] 1.4 Keep the shared foundation runtime-agnostic and define plugin-style adapter seams so future base-agent runtimes can plug in without refactoring the local workflow layers.

## 2. CLI Command Implementations

- [x] 2.1 Refactor the CLI entrypoint so `new`, `validate`, `inspect`, and `pack` dispatch to real handlers while other commands keep the placeholder behavior.
- [x] 2.2 Implement `suit new <name>` to create a minimal suit directory with valid starter content.
- [x] 2.3 Implement `suit validate <path>` and `suit inspect <path>` on top of shared core loading and validation services.
- [x] 2.4 Implement `suit pack <path>` to validate first and then produce a `<name>-<version>.suit.tgz` archive.

## 3. Packaging And Reporting

- [x] 3.1 Add core report builders for validation and inspect summaries so CLI rendering is deterministic and testable.
- [x] 3.2 Implement archive staging that normalizes packaged files under `package/` and includes the required manifest and asset content only when validation succeeds.
- [x] 3.3 Decide and document the first-pass behavior for validation report persistence versus terminal-only output.

## 4. Verification And Fixtures

- [x] 4.1 Expand fixtures to cover a valid minimal suit plus at least one invalid suit case with a missing referenced asset or malformed manifest.
- [x] 4.2 Add CLI smoke and integration tests covering successful `new`, `validate`, `inspect`, and `pack` flows plus placeholder behavior for still-unimplemented commands.
- [x] 4.3 Update `README.md` and any relevant contributor docs so the documented local verification flow includes the first executable local Suit workflow.
