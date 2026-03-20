## Context

The repository is effectively greenfield: it has a product-level design note in `docs/` and an initialized OpenSpec workspace, but no source tree, package manifests, or executable CLI. The first implementation step needs to create a stable development substrate that matches the detailed design's monorepo direction without prematurely implementing extract, apply, registry, or schema logic.

This change affects multiple modules at once because package boundaries, root scripts, the Bun workspace contract, and the `suit` executable all need to be established together. The design therefore needs to optimize for low-friction local development, explicit package ownership, and a command surface that can grow incrementally.

## Goals / Non-Goals

**Goals:**
- Create a root Bun-managed TypeScript workspace that can build and test all initial packages from the repository root.
- Establish the initial package layout described in the detailed design so later work lands in stable module boundaries.
- Expose a working `suit` CLI binary with help output and registered v0.1 command names.
- Make unimplemented commands fail consistently so future changes can fill behavior in command-by-command.
- Document how contributors install dependencies, run checks, and verify the scaffold locally.

**Non-Goals:**
- Implement any business behavior for `extract`, `validate`, `pack`, `publish`, `pull`, or `apply`.
- Finalize the Suit manifest schema, runtime adapters, or packaging format.
- Introduce remote registry integration, CI release automation, or containerized developer environments.
- Guarantee final package names, runtime support matrices, or future package publishing details.

## Decisions

### Use Bun workspaces for the initial monorepo

The root workspace will use Bun workspaces and Bun's package manager/runtime instead of npm, pnpm, or a task orchestrator. This keeps bootstrap friction low because contributors only need Bun installed, while still allowing per-package manifests, workspace-aware scripts, and fast local execution from the repository root.

Alternatives considered:
- `npm` workspaces: ubiquitous, but slower and less opinionated for the all-in-one install, script, and test experience we want during bootstrap.
- `pnpm` workspaces: strong monorepo ergonomics, but adds one more tool choice without giving us Bun's integrated runtime and test runner.
- `turbo` or `nx`: useful later for caching and graph-aware tasks, but unnecessary during initial bootstrap.

### Create explicit packages for CLI, core, schema, adapters, and registry

The initial source tree will mirror the product design: `packages/cli`, `packages/core`, `packages/schema`, `packages/adapter-openclaw`, `packages/adapter-claude-code`, `packages/adapter-codex`, and `packages/registry`. Each package gets its own manifest and source entrypoint even if most packages only export placeholders at first.

This keeps future work isolated and avoids a later split of a single oversized package into multiple modules after APIs have already formed.

Alternatives considered:
- Start with a single package and split later: faster in the short term, but likely to create churn because the design already assumes distinct module responsibilities.
- Create only `cli` and `core` now: simpler, but delays validating the intended package topology and root scripts against the actual target architecture.

### Share a common TypeScript baseline and root quality scripts

The workspace will use a shared base `tsconfig` and root scripts for `build`, `test`, `lint`, and `typecheck`, executed through Bun workspace commands. Package-level scripts remain the source of truth, while root scripts fan out through the workspace. This gives one predictable contract for humans and future CI.

Alternatives considered:
- Per-package ad hoc configuration: too much duplication and likely to drift immediately.
- Root-only scripts with no package-level scripts: hides package responsibilities and makes packages harder to work with independently.

### Provide a real CLI binary with not-yet-implemented command handlers

The `cli` package will ship an executable `suit` binary that wires the top-level command names from the v0.1 design. Each command will route to its own module and, until implemented, return a clear "not implemented" message with a non-zero exit code.

This preserves the public command surface early, allows help text and smoke tests, and prevents ambiguous partial behavior.

Alternatives considered:
- Expose only `--help` and add commands later: smaller initial diff, but does not validate the intended CLI surface.
- Stub commands silently or exit zero: misleading because callers cannot distinguish a placeholder from a successful run.

### Include bootstrap documentation and a minimal fixture

The change will add contributor-facing setup instructions plus a minimal fixture or example directory that later commands can reuse for smoke tests. This ensures the scaffold is testable by someone who did not create it and gives future command work a stable sample target.

Alternatives considered:
- Defer docs and fixtures to later: faster initially, but makes the scaffold harder to verify and onboarding less deterministic.

## Risks / Trade-offs

- [Workspace structure may be wider than current implementation needs] → Keep placeholder packages minimal and restrict them to entrypoints plus package metadata.
- [Leaning on Bun-specific workflows can increase coupling to one toolchain] → Keep package manifests standards-compliant and isolate Bun-specific behavior to root scripts and documentation where possible.
- [Registered placeholder commands can look unfinished to contributors] → Make help output and command errors explicit that the surface is scaffolded for future implementation.
- [Adding lint, test, and typecheck too early can slow early iterations] → Use lightweight default configurations and only require checks that the bootstrap can satisfy immediately.

## Migration Plan

1. Add root workspace files: `package.json`, `bunfig.toml` if needed, shared `tsconfig`, quality-tool configuration, and repository-level scripts.
2. Create package directories and per-package manifests for the planned module layout.
3. Implement the `packages/cli` binary, help text, and placeholder command modules.
4. Add minimal exports or placeholders to non-CLI packages so the workspace builds cleanly.
5. Add contributor documentation and a reusable fixture/example directory.
6. Verify the scaffold by running the documented root scripts.

Rollback is straightforward because this is a greenfield bootstrap: revert the added files if the chosen toolchain or layout proves unsuitable before later features depend on it.

## Open Questions

- What minimum Bun version should the project require in root documentation and configuration?
- Should formatting be enforced in this bootstrap change, or deferred until the first substantial implementation change?
- Do we want local CI workflow files in the bootstrap scope, or should that remain a follow-up change after the first executable commands land?
