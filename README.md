# AgentSuit

AgentSuit is a Bun-managed TypeScript monorepo for building the `suit` CLI and the supporting packages behind portable Agent Suit workflows.

## Prerequisites

- Bun `1.3.5` or newer

## Getting Started

```bash
bun install
```

## Workspace Commands

```bash
bun run check
bun run build
bun run lint
bun run typecheck
bun run test
```

`bun run check` is the full local quality gate and runs lint, typecheck, test, and build in sequence.

To inspect the scaffolded CLI:

```bash
./node_modules/.bin/suit --help
./node_modules/.bin/suit init
```

## Package Layout

```text
packages/
  cli/
  core/
  schema/
  adapter-openclaw/
  adapter-claude-code/
  adapter-codex/
  registry/
```

- `packages/cli`: `suit` executable and top-level command registration
- `packages/core`: shared application primitives
- `packages/schema`: schema-facing types and validators
- `packages/adapter-openclaw`: OpenClaw extraction and apply bindings
- `packages/adapter-claude-code`: Claude Code apply bindings
- `packages/adapter-codex`: Codex apply bindings
- `packages/registry`: pull, publish, and cache behavior

## Example Fixture

A minimal suit fixture lives under `examples/suits/minimal-starter` and can be used as a local verification target while the CLI is still scaffold-only.
