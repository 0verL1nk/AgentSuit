# Repository Guidelines

## Project Structure & Module Organization
`AgentSuit` is a Bun-managed TypeScript monorepo. Workspace packages live in `packages/*`; each package keeps source in `src/` and builds to `dist/`. The CLI entrypoint is [`packages/cli/src/index.ts`](/home/ling/AgentSuit/packages/cli/src/index.ts). Cross-package integration and contract tests live in `tests/*.test.js`. Example Suits for local verification are under `examples/suits/`. Spec-driven change artifacts live in `openspec/`, and runtime helper scripts live in `scripts/`.

## Build, Test, and Development Commands
Install dependencies with `bun install`.

- `bun run check`: full local quality gate; runs lint, typecheck, tests, and build.
- `bun run lint`: runs Biome plus any package-level lint scripts.
- `bun run typecheck`: validates all workspace TypeScript projects with `tsc --noEmit`.
- `bun run test`: runs Bun tests in the root and workspaces.
- `bun run build`: builds every workspace package.
- `bun run docker:build:runtime`: builds the runtime image from `Dockerfile.runtime`.
- `bun run docker:smoke:runtime`: runs the Docker runtime smoke test.

For CLI sanity checks, use `./node_modules/.bin/suit validate examples/suits/minimal-starter` or `./node_modules/.bin/suit serve examples/suits/minimal-starter`.

## Coding Style & Naming Conventions
Use TypeScript ESM and prefer existing workspace packages or the Node/Bun standard library before adding dependencies. Biome enforces spaces for indentation, double quotes, and semicolons; run `bun run lint` before opening a PR. Keep package names in the `@agentsuit/<name>` form. Export public package APIs from `src/index.ts`. Favor clear command and function names such as `handleValidateCommand` over abbreviations.

## Testing Guidelines
Tests use `bun:test`. Add or update a `*.test.js` file in `tests/` for contributor-visible behavior changes. Follow the existing naming pattern by behavior area, for example `cli.smoke.test.js` or `runtime-service-mvp.test.js`. CLI changes should cover both the success path and at least one failure path, and `bun run check` should pass before review.

## Spec & CLI Contract Expectations
Behavior changes should align with the relevant spec in `openspec/specs/` and, for new work, with an active change under `openspec/changes/`. CLI contributions must stay script-friendly: deterministic exit codes, actionable help text, stdout for normal output, and stderr for diagnostics.

## Commit & Pull Request Guidelines
Recent history uses Conventional Commit prefixes such as `feat:` and `fix:`; keep subjects imperative and concise. PRs should describe the user-visible change, list affected packages, link the related issue or OpenSpec change when applicable, and include the verification commands you ran. Add terminal output or screenshots only when they clarify changed CLI or runtime behavior.
