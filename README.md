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
./node_modules/.bin/suit new demo-suit
./node_modules/.bin/suit validate examples/suits/minimal-starter
./node_modules/.bin/suit inspect examples/suits/minimal-starter
./node_modules/.bin/suit pack examples/suits/minimal-starter
```

## Local Suit Workflow

The first executable local workflow currently supports:

```bash
./node_modules/.bin/suit new demo-suit
./node_modules/.bin/suit validate ./demo-suit
./node_modules/.bin/suit inspect ./demo-suit
./node_modules/.bin/suit pack ./demo-suit
```

`validate` currently prints a deterministic terminal summary and returns a non-zero exit status for validation failures. It does not write `validate-report.json` to disk yet.

## Runtime MVP

The repository now also includes a minimal service runtime MVP:

```bash
./node_modules/.bin/suit serve examples/suits/minimal-starter
./node_modules/.bin/suit serve examples/suits/minimal-starter --host 127.0.0.1 --port 8080
./node_modules/.bin/suit serve examples/suits/minimal-starter --base-agent claude-code
```

On successful startup, `serve` prints a health URL and keeps the runtime host alive until interrupted.

## Channel Exposures

The runtime can also expose selected chat channels through plugins.

Discord IM MVP:

```bash
./node_modules/.bin/suit serve examples/suits/minimal-starter \
  --expose im \
  --im-adapter discord
```

Detailed channel docs live under [`docs/channels/`](./docs/channels/):

- [`docs/channels/discord.md`](./docs/channels/discord.md)
- [`docs/channels/plugin-discovery.md`](./docs/channels/plugin-discovery.md)

Next TODO for the Discord / Claude line:

- Improve the Suit-owned per-thread conversation context pipeline, including transcript carry-over, busy-thread coalescing strategy refinement, and a clearer context compaction story on top of the Claude Agent SDK session model.
- The next step after that is Suit/runtime-level bootstrap context injection and SOUL system prompt injection, so new sessions can start from a stable persona and runtime bootstrap state instead of relying only on incremental chat history.

### Claude Code Base Agent

The first real base-agent integration is `claude-code`. It uses the Claude Agent SDK and is selected explicitly from `suit serve`.

Required environment:

```bash
export ANTHROPIC_API_KEY=your-key
```

Local examples:

```bash
./node_modules/.bin/suit serve examples/suits/minimal-starter --base-agent claude-code
AGENTSUIT_BASE_AGENT=claude-code ./node_modules/.bin/suit serve examples/suits/minimal-starter
AGENTSUIT_CLAUDE_MODEL=claude-sonnet-4-6 ./node_modules/.bin/suit serve examples/suits/minimal-starter --base-agent claude-code
AGENTSUIT_CLAUDE_WORKDIR=$PWD/examples/suits/minimal-starter ./node_modules/.bin/suit serve examples/suits/minimal-starter --base-agent claude-code
```

Current adapter-side env knobs:

- `AGENTSUIT_BASE_AGENT`: CLI default base agent selector when `--base-agent` is omitted
- `AGENTSUIT_CLAUDE_MODEL`: optional Claude model override passed to the SDK
- `AGENTSUIT_CLAUDE_WORKDIR`: optional working directory override for Claude sessions
- `AGENTSUIT_CLAUDE_PATH`: optional Claude Code executable path override

If Claude credentials are missing, `suit serve` fails fast with a deterministic error instead of falling back to the mock runtime.

## Docker Runtime MVP

Build the single-container runtime image:

```bash
docker build -f Dockerfile.runtime -t agentsuit/runtime:latest .
```

Run the default container contract with a valid Suit mounted into `/app/suit` and writable state/report volumes:

```bash
docker run --rm -p 8080:8080 \
  -v $PWD/examples/suits/minimal-starter:/app/suit:ro \
  -v agentsuit-state:/app/state \
  -v agentsuit-reports:/app/reports \
  agentsuit/runtime:latest
```

The image defaults to:

- `serve /app/suit --host 0.0.0.0 --port 8080`
- `/app/suit` as the mounted Suit directory
- `/app/state` as writable runtime state storage
- `/app/reports` as writable runtime reports storage
- `/healthz` as the container health endpoint

Override the default container command when you want to inspect or validate a mounted Suit without Docker Compose:

```bash
docker run --rm agentsuit/runtime:latest inspect /app/suit
docker run --rm agentsuit/runtime:latest validate /app/suit
```

Run Claude in the single-container image by passing the base-agent flag and Claude credentials:

```bash
docker run --rm -p 8080:8080 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e AGENTSUIT_BASE_AGENT=claude-code \
  -v $PWD/examples/suits/minimal-starter:/app/suit:ro \
  -v agentsuit-state:/app/state \
  -v agentsuit-reports:/app/reports \
  agentsuit/runtime:latest
```

Optional live smoke for a credentialed environment:

```bash
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
./node_modules/.bin/suit serve examples/suits/minimal-starter --base-agent claude-code --host 127.0.0.1 --port 8080
```

Run the Docker smoke verification workflow:

```bash
bun run docker:smoke:runtime
```

## Package Layout

```text
packages/
  adapter-api/
  cli/
  core/
  plugin-api/
  runtime/
  schema/
  adapter-openclaw/
  adapter-claude-code/
  adapter-codex/
  plugin-im-chat/
  registry/
```

- `packages/adapter-api`: public contracts for future base-agent adapters
- `packages/cli`: `suit` executable and top-level command registration
- `packages/core`: shared application primitives
- `packages/plugin-api`: public contracts for future exposure plugins
- `packages/plugin-im-chat`: Discord-first IM exposure plugin built around Vercel Chat SDK
- `packages/runtime`: in-process runtime host, session contracts, and health endpoint behavior
- `packages/schema`: schema-facing types and validators
- `packages/adapter-openclaw`: OpenClaw extraction and apply bindings
- `packages/adapter-claude-code`: Claude Code apply bindings
- `packages/adapter-codex`: Codex apply bindings
- `packages/registry`: pull, publish, and cache behavior

## Example Fixture

Fixtures under `examples/suits/` can be used as local verification targets:

- `minimal-starter`: valid minimal suit for `validate`, `inspect`, and `pack`
- `missing-overlay`: invalid suit with a missing referenced prompt file for failure-path validation tests

## Environment Example

An example non-secret environment template lives at [`/.env.example`](./.env.example).
