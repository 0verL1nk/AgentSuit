## 1. Root Workspace Scaffold

- [x] 1.1 Create the root `package.json` with Bun workspaces, Bun version requirements, and root `build`, `lint`, `typecheck`, and `test` scripts.
- [x] 1.2 Add shared TypeScript configuration files and the baseline lint/test tool configuration used by all packages.
- [x] 1.3 Add any repository-level ignore files, `bunfig` configuration, or support files needed for the workspace tooling to run cleanly from the root.

## 2. Package Layout

- [x] 2.1 Create the initial `packages/cli`, `packages/core`, `packages/schema`, `packages/adapter-openclaw`, `packages/adapter-claude-code`, `packages/adapter-codex`, and `packages/registry` directories with per-package manifests.
- [x] 2.2 Add minimal source entrypoints or placeholder exports for each non-CLI package so the workspace can build and type-check before feature logic exists.

## 3. CLI Foundation

- [x] 3.1 Implement the `packages/cli` executable entrypoint and help output for the `suit` command.
- [x] 3.2 Register the v0.1 top-level commands `init`, `new`, `extract`, `validate`, `inspect`, `redact`, `pack`, `unpack`, `publish`, `pull`, `add`, and `apply`.
- [x] 3.3 Add placeholder command handlers that exit non-zero with a clear not-implemented message for unimplemented commands.
- [x] 3.4 Add smoke tests covering CLI help output and the placeholder failure contract for at least one registered command.

## 4. Documentation And Verification

- [x] 4.1 Write contributor setup documentation describing Bun prerequisites, dependency installation, root scripts, and the package layout.
- [x] 4.2 Add a minimal example or fixture asset that contributors can use to verify the scaffold locally.
- [x] 4.3 Run the documented root checks and update the documentation or scripts to match the verified workflow.
