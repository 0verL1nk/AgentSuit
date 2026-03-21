## Context

The current repository proves only that the `suit` binary exists and that the v0.1 command names are registered. All supporting packages remain placeholders, while the detailed design expects the core layer to own manifest parsing, validation, asset resolution, packaging, and report generation before runtime extraction and application are attempted.

This change is cross-cutting because the first real inner loop touches the CLI, schema model, core services, tests, and example fixtures at the same time. The implementation needs to create one coherent local workflow that can serve as the execution substrate for later `extract`, `pull`, `publish`, and `apply` work rather than shipping isolated command-specific logic.

## Goals / Non-Goals

**Goals:**
- Turn `new`, `validate`, `inspect`, and `pack` into real commands with deterministic behavior.
- Introduce a minimal but explicit Suit manifest model and validation contract that works for repository fixtures and newly generated suits.
- Centralize shared file-system, parsing, validation, reporting, and packaging behavior in `packages/core` and `packages/schema` so later commands can reuse it.
- Keep the first workflow strictly local and offline, using the repository fixture as a reference implementation and test target.
- Preserve the existing placeholder behavior for every command outside the new local inner loop.

**Non-Goals:**
- Implement runtime extraction, runtime apply, remote pull/publish, redaction, or dependency resolution beyond what local validation requires.
- Finalize every field from the detailed design's aspirational manifest example; the first schema only needs the subset required by local creation, validation, inspection, and packing.
- Introduce a hosted registry, release pipeline, or full security policy enforcement for hooks and external tools.
- Guarantee archive compatibility with future signed package formats or registry metadata.

## Decisions

### Introduce a minimal canonical Suit model first, not the full aspirational schema

The codebase needs one source of truth for the subset of manifest fields already exercised by the example fixture and the first commands. The initial model should cover the minimal local workflow: top-level identity (`apiVersion`, `kind`), metadata, runtime compatibility, and prompt overlay references. Validation can reject malformed manifests while tolerating additional unknown sections that later changes may formalize.

This keeps the first implementation small enough to finish while still creating a reusable contract for future commands.

Alternatives considered:
- Implement the entire detailed design schema immediately: more complete, but would turn the first executable change into a large modeling project before any command becomes useful.
- Keep schema logic embedded inside each command: faster short term, but would duplicate parsing and make later commands inconsistent.

### Put filesystem orchestration in core and keep CLI handlers thin

`packages/cli` should only parse arguments, call shared services, and render human-readable results. `packages/core` should own operations like loading a suit from disk, resolving referenced files, producing validation findings, generating inspect summaries, creating scaffolds, and building `.suit.tgz` packages. `packages/schema` should define types, enums, and validation helpers shared by core and tests.

This preserves package boundaries established in the bootstrap change and prevents command handlers from becoming the de facto business layer.

Alternatives considered:
- Implement everything in the CLI package first: simpler diff, but it collapses module boundaries immediately and creates avoidable migration work.
- Put validation directly into `schema`: too narrow, because file existence checks, reports, and packaging are operational concerns rather than pure schema concerns.

### Keep runtime-specific behavior behind extensible plugin-style adapter boundaries

Even though this change only implements the local authoring loop, the base architecture must remain open to additional runtimes and base agents. The shared layers created here should therefore avoid embedding assumptions about OpenClaw, Claude Code, Codex, or any future base agent into manifest parsing, validation, or command orchestration. Runtime-specific extraction or apply behavior should be introduced later through explicit adapter interfaces and a plugin-style registry rather than by branching inside generic core services.

This preserves the long-term goal that Agent Suit can target many different base agents without needing to rewrite the foundation once more adapters arrive. In practice, the current change should establish naming and module seams that allow future runtime plugins to register capabilities against the CLI and shared workflow engine instead of patching core code paths directly.

Alternatives considered:
- Let core utilities accumulate runtime-specific conditionals over time: expedient short term, but guarantees tight coupling and future refactors once new runtimes appear.
- Defer all extensibility concerns until the first adapter implementation: smaller initial scope, but increases the chance that the local workflow hard-codes assumptions into the wrong layer.
- Build a heavyweight plugin loader now: more future-proof on paper, but unnecessary before the first shared command and model boundaries are stable.

### Treat `validate` as the foundational operation for the inner loop

`validate` should become the central operation that all other local commands depend on. `inspect` should load the same parsed suit representation plus warnings to render a summary; `pack` should validate first and refuse to archive an invalid suit; `new` should generate a scaffold that already passes validation.

This creates one consistent local contract and reduces the risk that each command drifts into its own interpretation of the manifest.

Alternatives considered:
- Let `pack` or `inspect` reimplement their own loose checks: faster to wire individually, but inconsistent and harder to test.
- Build `new` first without validation rules: results in generated output that may not be trustworthy.

### Use deterministic report objects even before adding JSON mode

The detailed design calls for `validate-report.json` and later machine-readable CLI output. Even if the first iteration only prints human-readable terminal output, core should still produce deterministic report objects that can be serialized by commands and asserted in tests. `validate` should emit a report file in the suit directory only when explicitly part of the command contract; otherwise the command can print a summary derived from the same structure.

This keeps reporting logic testable and avoids coupling validation semantics to terminal formatting.

Alternatives considered:
- Format strings directly in command handlers: easy to start, but brittle and hard to reuse for future JSON mode.
- Write report files for every command invocation unconditionally: creates unwanted filesystem side effects for read-oriented commands.

### Package archives from a normalized `package/` staging layout

`pack` should build archives using the documented internal layout rooted at `package/`, including `suit.yaml`, `README.md`, and any present asset directories. The packager should stage only files that belong to the portable Suit contract and should reject invalid or missing required files before producing the archive name `<name>-<version>.suit.tgz`.

Using a normalized archive root now makes future `unpack`, `pull`, and `publish` work more predictable.

Alternatives considered:
- Archive the suit directory as-is: simpler, but leaks local directory names and makes package structure inconsistent.
- Delay the `package/` layout until registry work: would create churn for pack/unpack compatibility.

## Risks / Trade-offs

- [The minimal manifest model may omit fields that later commands want immediately] → Keep parsing extensible and allow additive schema growth without breaking the first fixtures.
- [Validation scope could grow too quickly into full redaction and dependency resolution] → Limit this change to structural validation, supported runtime names, and local asset existence checks.
- [Packaging logic can become platform-sensitive because of path handling and tar behavior] → Normalize archive paths and test against the repository fixture rather than relying only on ad hoc manual runs.
- [Generated `new` output could diverge from the repository fixture over time] → Reuse the same minimal manifest conventions and assert scaffold validity in tests.
- [Changing CLI behavior can invalidate bootstrap assumptions] → Modify only the placeholder requirement for implemented commands and keep the remaining command surface unchanged.

## Migration Plan

1. Define the minimal Suit manifest types, parsing helpers, and validation/reporting primitives in `packages/schema` and `packages/core`.
2. Implement `suit new` using the same manifest conventions as the minimal fixture so a fresh scaffold is immediately valid.
3. Implement `suit validate` on top of shared parsing and filesystem checks, then reuse the parsed result for `inspect`.
4. Implement `suit pack` to validate first and build the normalized `.suit.tgz` archive layout.
5. Extend CLI and core tests to cover successful and failing validation cases, inspect summaries, scaffold generation, and archive creation.
6. Update repository documentation and fixtures if command behavior or expected local verification steps change.

Rollback is straightforward because the commands are local-only: revert the new command handlers and shared core/schema modules, and the CLI will return to placeholder behavior.

## Open Questions

- Should the first `validate` implementation write `validate-report.json` by default, or only expose the report in-process until JSON output mode lands?
- How aggressively should the first manifest parser preserve unknown fields for future commands versus rejecting them for strictness?
- Do we want `pack` to include empty optional directories from `new`, or only directories and files that actually exist?
