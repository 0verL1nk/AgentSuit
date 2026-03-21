import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { createClaudeCodeAdapterDefinition } from "../packages/adapter-claude-code/src/index.ts";
import { createCodexAdapterDefinition } from "../packages/adapter-codex/src/index.ts";
import { createOpenClawAdapterDefinition } from "../packages/adapter-openclaw/src/index.ts";
import { loadSuit } from "../packages/core/src/index.ts";
import {
  createRuntimeAdapterRegistry,
  createRuntimeHost,
} from "../packages/runtime/src/index.ts";

const repoRoot = process.cwd();

function createAdapterEventStream() {
  const events = [];
  const pendingResolvers = [];
  let closed = false;

  function emit(event) {
    if (pendingResolvers.length > 0) {
      const resolve = pendingResolvers.shift();
      resolve?.({ done: false, value: event });
      return;
    }

    events.push(event);
  }

  function complete() {
    closed = true;

    while (pendingResolvers.length > 0) {
      const resolve = pendingResolvers.shift();
      resolve?.({ done: true, value: undefined });
    }
  }

  return {
    complete,
    emit,
    stream() {
      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              if (events.length > 0) {
                const value = events.shift();
                if (value) {
                  return Promise.resolve({ done: false, value });
                }
              }

              if (closed) {
                return Promise.resolve({ done: true, value: undefined });
              }

              return new Promise((resolve) => {
                pendingResolvers.push(resolve);
              });
            },
          };
        },
      };
    },
  };
}

function createWorkingAdapter(name = "stub-adapter") {
  return {
    async capabilities() {
      return {
        sessionLifecycle: { support: "native" },
      };
    },
    async createSession({ runtimeSessionId }) {
      const stream = createAdapterEventStream();

      return {
        async close() {
          stream.emit({
            payload: {
              adapter: {
                name,
                providerSessionId: `provider-${runtimeSessionId}`,
              },
            },
            sessionId: runtimeSessionId,
            timestamp: new Date().toISOString(),
            type: "session.completed",
          });
          stream.complete();
        },
        async interrupt() {
          stream.emit({
            payload: {
              adapter: {
                name,
                providerSessionId: `provider-${runtimeSessionId}`,
              },
              error: "interrupted-by-test",
            },
            sessionId: runtimeSessionId,
            timestamp: new Date().toISOString(),
            type: "session.failed",
          });
          stream.complete();
        },
        async sendInput(input) {
          stream.emit({
            payload: {
              adapter: {
                name,
                providerSessionId: `provider-${runtimeSessionId}`,
              },
              provider: { eventType: "provider.message.delta" },
              text: input.text,
            },
            sessionId: runtimeSessionId,
            timestamp: new Date().toISOString(),
            type: "message.delta",
          });
          stream.emit({
            payload: {
              adapter: {
                name,
                providerSessionId: `provider-${runtimeSessionId}`,
              },
              provider: { eventType: "provider.message.completed" },
            },
            sessionId: runtimeSessionId,
            timestamp: new Date().toISOString(),
            type: "message.completed",
          });
        },
        streamEvents() {
          return stream.stream();
        },
      };
    },
    async detect() {
      return { available: true };
    },
    name,
    version: "1.0.0-test",
  };
}

function createClaudeSdkRun(events, options = {}) {
  const queue = [...events];
  const pendingResolvers = [];
  let closed = false;
  let interrupted = false;

  return {
    close() {
      closed = true;

      while (pendingResolvers.length > 0) {
        const resolve = pendingResolvers.shift();
        resolve?.({ done: true, value: undefined });
      }
    },
    async interrupt() {
      interrupted = true;
      options.onInterrupt?.();

      while (pendingResolvers.length > 0) {
        const resolve = pendingResolvers.shift();
        resolve?.({ done: true, value: undefined });
      }
    },
    stream() {
      return {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              if (queue.length > 0) {
                const value = queue.shift();
                return { done: false, value };
              }

              if (closed || interrupted) {
                return { done: true, value: undefined };
              }

              if (!options.waitForInterrupt) {
                return { done: true, value: undefined };
              }

              return await new Promise((resolve) => {
                pendingResolvers.push(resolve);
              });
            },
          };
        },
      };
    },
  };
}

describe("runtime adapter contracts", () => {
  test("adapter packages export hardened adapter definitions", async () => {
    const claude = createClaudeCodeAdapterDefinition({ env: {} });
    const codex = createCodexAdapterDefinition();
    const openclaw = createOpenClawAdapterDefinition();

    expect([claude.name, codex.name, openclaw.name]).toEqual([
      "claude-code",
      "codex",
      "openclaw",
    ]);
    await expect(claude.detect()).resolves.toEqual({
      available: false,
      message:
        "Claude Code credentials are not configured. Set ANTHROPIC_API_KEY or a supported Claude provider environment variable.",
    });
  });

  test("creates Claude-backed sessions with suit instructions, workdir, and MCP wiring", async () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));
    const invocations = [];
    const adapter = createClaudeCodeAdapterDefinition({
      env: { ANTHROPIC_API_KEY: "test-key" },
      sdk: {
        async run(input) {
          invocations.push(input);

          return createClaudeSdkRun([
            {
              providerEventType: "sdk.message.delta",
              providerSessionId: "claude-session-1",
              text: "hello from claude",
              type: "text-delta",
            },
            {
              providerEventType: "sdk.message.completed",
              providerSessionId: "claude-session-1",
              type: "message-complete",
            },
          ]);
        },
      },
    });

    const session = await adapter.createSession({
      mcpServers: [
        {
          args: ["-y", "@modelcontextprotocol/server-filesystem", suit.rootDir],
          command: "npx",
          env: { MCP_MODE: "readonly" },
          name: "filesystem",
        },
      ],
      runtimeSessionId: "runtime-session-1",
      suit,
    });
    const sendPromise = session.sendInput({
      text: "inspect the project",
      type: "text",
    });
    const received = [];

    for await (const event of session.streamEvents()) {
      received.push(event);
      if (event.type === "message.completed") {
        break;
      }
    }

    await sendPromise;

    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.cwd).toBe(suit.rootDir);
    expect(invocations[0]?.prompt).toBe("inspect the project");
    expect(invocations[0]?.instructions).toContain("Minimal Starter Prompt");
    expect(invocations[0]?.instructions).toContain("Prefer explicit, testable");
    expect(invocations[0]?.mcpServers).toEqual({
      filesystem: {
        args: ["-y", "@modelcontextprotocol/server-filesystem", suit.rootDir],
        command: "npx",
        env: { MCP_MODE: "readonly" },
      },
    });
    expect(received.map((event) => event.type)).toEqual([
      "message.delta",
      "message.completed",
    ]);
    expect(received[0]?.payload?.adapter?.providerSessionId).toBe(
      "claude-session-1",
    );
    expect(received[0]?.payload?.provider?.eventType).toBe("sdk.message.delta");
    expect(received[0]?.payload?.text).toBe("hello from claude");
  });

  test("interrupts active Claude-backed work deterministically", async () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));
    let interrupted = false;
    const adapter = createClaudeCodeAdapterDefinition({
      env: { ANTHROPIC_API_KEY: "test-key" },
      sdk: {
        async run() {
          return createClaudeSdkRun([], {
            onInterrupt() {
              interrupted = true;
            },
            waitForInterrupt: true,
          });
        },
      },
    });

    const session = await adapter.createSession({
      runtimeSessionId: "runtime-session-2",
      suit,
    });
    const sendPromise = session.sendInput({
      text: "long running task",
      type: "text",
    });
    const iterator = session.streamEvents()[Symbol.asyncIterator]();

    await session.interrupt();

    const interruptedEvent = await iterator.next();
    await sendPromise;

    expect(interrupted).toBe(true);
    expect(interruptedEvent.value?.type).toBe("session.failed");
    expect(interruptedEvent.value?.payload?.error).toBe("interrupted");
  });

  test("surfaces provider failures as deterministic session errors", async () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));
    const adapter = createClaudeCodeAdapterDefinition({
      env: { ANTHROPIC_API_KEY: "test-key" },
      sdk: {
        async run() {
          throw new Error("sdk unavailable");
        },
      },
    });

    const session = await adapter.createSession({
      runtimeSessionId: "runtime-session-3",
      suit,
    });
    const iterator = session.streamEvents()[Symbol.asyncIterator]();

    await expect(
      session.sendInput({ text: "trigger failure", type: "text" }),
    ).resolves.toBeUndefined();

    const failedEvent = await iterator.next();

    expect(failedEvent.value?.type).toBe("session.failed");
    expect(failedEvent.value?.payload?.error).toContain("sdk unavailable");
  });

  test("registers and retrieves adapter definitions by name", () => {
    const registry = createRuntimeAdapterRegistry();
    const adapter = createWorkingAdapter("claude-code");

    registry.register(adapter);

    expect(registry.list()).toEqual([adapter]);
    expect(registry.get("claude-code")).toEqual(adapter);
  });

  test("rejects duplicate adapter registrations", () => {
    const registry = createRuntimeAdapterRegistry();

    registry.register(createWorkingAdapter("claude-code"));

    expect(() =>
      registry.register(createWorkingAdapter("claude-code")),
    ).toThrow('Runtime adapter "claude-code" is already registered.');
  });

  test("binds a selected adapter to runtime sessions and normalizes adapter metadata", async () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));
    const registry = createRuntimeAdapterRegistry();

    registry.register(createWorkingAdapter("claude-code"));

    const host = createRuntimeHost({
      adapterName: "claude-code",
      adapterRegistry: registry,
      suit,
    });

    const report = await host.start();
    expect(report.adapterName).toBe("claude-code");

    const session = await host.sessionApi.startSession();
    const received = [];
    const stream = host.sessionApi.streamEvents(session.sessionId);

    await host.sessionApi.sendInput(session.sessionId, {
      text: "hello adapter",
      type: "text",
    });

    for await (const event of stream) {
      received.push(event);
      if (event.type === "message.completed") {
        break;
      }
    }

    expect(received[0]?.payload?.adapter?.name).toBe("claude-code");
    expect(received[1]?.payload?.provider?.eventType).toBe(
      "provider.message.delta",
    );
    expect(received.map((event) => event.type)).toEqual([
      "session.started",
      "message.delta",
      "message.completed",
    ]);

    await host.stop();
  });

  test("fails startup predictably for an unknown adapter", async () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));
    const host = createRuntimeHost({
      adapterName: "missing-adapter",
      adapterRegistry: createRuntimeAdapterRegistry(),
      suit,
    });

    await expect(host.start()).rejects.toThrow(
      'Unknown runtime adapter "missing-adapter".',
    );
  });

  test("fails startup predictably for an unavailable adapter", async () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));
    const registry = createRuntimeAdapterRegistry();

    registry.register({
      async capabilities() {
        return {
          sessionLifecycle: { support: "degraded" },
        };
      },
      async createSession() {
        throw new Error("should not be called");
      },
      async detect() {
        return { available: false, message: "missing provider binary" };
      },
      name: "offline-adapter",
      version: "0.1.0-test",
    });

    const host = createRuntimeHost({
      adapterName: "offline-adapter",
      adapterRegistry: registry,
      suit,
    });

    await expect(host.start()).rejects.toThrow(
      'Runtime adapter "offline-adapter" is not available: missing provider binary',
    );
  });

  test("fails session startup predictably when the adapter cannot create a session", async () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));
    const registry = createRuntimeAdapterRegistry();

    registry.register({
      async capabilities() {
        return {
          sessionLifecycle: { support: "native" },
        };
      },
      async createSession() {
        throw new Error("provider boot failed");
      },
      async detect() {
        return { available: true };
      },
      name: "broken-adapter",
      version: "0.1.0-test",
    });

    const host = createRuntimeHost({
      adapterName: "broken-adapter",
      adapterRegistry: registry,
      suit,
    });

    await host.start();

    await expect(host.sessionApi.startSession()).rejects.toThrow(
      'Failed to start runtime session with adapter "broken-adapter": provider boot failed',
    );

    await host.stop();
  });

  test("fails startup predictably when Claude is selected but unavailable", async () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));
    const registry = createRuntimeAdapterRegistry();

    registry.register(
      createClaudeCodeAdapterDefinition({
        env: {},
      }),
    );

    const host = createRuntimeHost({
      adapterName: "claude-code",
      adapterRegistry: registry,
      suit,
    });

    await expect(host.start()).rejects.toThrow(
      'Runtime adapter "claude-code" is not available: Claude Code credentials are not configured. Set ANTHROPIC_API_KEY or a supported Claude provider environment variable.',
    );
  });
});
