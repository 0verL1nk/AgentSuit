import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  BaseAgentAdapter,
  BaseAgentAdapterSession,
  BaseAgentAdapterSessionContext,
} from "@agentsuit/adapter-api";
import type { AgentEvent } from "@agentsuit/runtime";
import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";

import {
  type ClaudeAgentSdkFacade,
  type ClaudeSdkRun,
  createClaudeAgentSdkFacade,
} from "./sdk-facade";

export const packageName = "@agentsuit/adapter-claude-code";

const CLAUDE_CONFIG_ERROR =
  "Claude Code credentials are not configured. Set ANTHROPIC_API_KEY or a supported Claude provider environment variable.";

const CLAUDE_PROVIDER_ENVIRONMENT_VARIABLES = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_FOUNDRY",
  "CLAUDE_CODE_USE_VERTEX",
] as const;

type AdapterEnvironment = Record<string, string | undefined>;

export interface ClaudeCodeAdapterOptions {
  env?: AdapterEnvironment;
  sdk?: ClaudeAgentSdkFacade;
}

interface EventChannel<T> {
  complete(): void;
  emit(event: T): void;
  stream(): AsyncIterable<T>;
}

export function describePackage(): string {
  return `${packageName} Claude Agent SDK bridge`;
}

export function createClaudeCodeAdapterDefinition(
  options: ClaudeCodeAdapterOptions = {},
): BaseAgentAdapter {
  const env = options.env ?? process.env;
  const sdk = options.sdk ?? createClaudeAgentSdkFacade();

  return {
    async capabilities() {
      return {
        interrupt: {
          details: "Uses Claude Agent SDK query interruption.",
          support: "native",
        },
        mcp: {
          details: "Runtime-provided MCP servers are forwarded to Claude.",
          support: "native",
        },
        sessionLifecycle: {
          details:
            "Claude-backed sessions are created via the Claude Agent SDK.",
          support: "native",
        },
        suitInstructions: {
          details:
            "Suit prompt overlays are appended to Claude's system prompt.",
          support: "native",
        },
        workingDirectory: {
          details:
            "Claude runs in the selected suit or configured working directory.",
          support: "native",
        },
      };
    },
    async createSession(context) {
      return createClaudeAdapterSession(context, env, sdk);
    },
    async detect() {
      if (hasClaudeRuntimeCredentials(env)) {
        return { available: true };
      }

      return {
        available: false,
        message: CLAUDE_CONFIG_ERROR,
      };
    },
    name: "claude-code",
    version: "0.2.0",
  };
}

function createClaudeAdapterSession(
  context: BaseAgentAdapterSessionContext,
  env: AdapterEnvironment,
  sdk: ClaudeAgentSdkFacade,
): BaseAgentAdapterSession {
  const channel = createEventChannel<AgentEvent>();
  const instructions = buildClaudeInstructions(context);
  const cwd = resolveClaudeWorkingDirectory(context, env);
  const mcpServers = buildClaudeMcpServers(context);
  const model = readEnv(env, "AGENTSUIT_CLAUDE_MODEL");
  const pathToClaudeCodeExecutable = readEnv(env, "AGENTSUIT_CLAUDE_PATH");

  let activeRun: ClaudeSdkRun | undefined;
  let activeRunPromise: Promise<ClaudeSdkRun> | undefined;
  let closed = false;

  function complete(): void {
    closed = true;
    channel.complete();
  }

  function emit(event: Omit<AgentEvent, "sessionId" | "timestamp">): void {
    if (closed) {
      return;
    }

    channel.emit({
      ...event,
      sessionId: context.runtimeSessionId,
      timestamp: new Date().toISOString(),
    });
  }

  function buildAdapterMetadata(providerSessionId?: string): {
    name: string;
    providerSessionId?: string;
  } {
    return {
      name: "claude-code",
      ...(providerSessionId ? { providerSessionId } : {}),
    };
  }

  return {
    async close() {
      if (closed) {
        return;
      }

      activeRun?.close();
      emit({ type: "session.completed" });
      complete();
    },
    async interrupt() {
      if (closed) {
        return;
      }

      const run =
        activeRun ?? (activeRunPromise ? await activeRunPromise : undefined);

      await run?.interrupt();
      run?.close();
      emit({
        payload: { error: "interrupted" },
        type: "session.failed",
      });
      complete();
    },
    async sendInput(input) {
      if (closed) {
        return;
      }

      if (activeRun) {
        emit({
          payload: {
            error: "claude-code session is already processing another input",
          },
          type: "session.failed",
        });
        complete();
        return;
      }

      try {
        const runInput = {
          cwd,
          instructions,
          prompt: input.text,
        } as Parameters<ClaudeAgentSdkFacade["run"]>[0];

        runInput.env = env;

        if (mcpServers) {
          runInput.mcpServers = mcpServers;
        }

        if (model) {
          runInput.model = model;
        }

        if (pathToClaudeCodeExecutable) {
          runInput.pathToClaudeCodeExecutable = pathToClaudeCodeExecutable;
        }

        activeRunPromise = Promise.resolve(sdk.run(runInput));

        activeRun = await activeRunPromise;
        activeRunPromise = undefined;

        for await (const event of activeRun.stream()) {
          if (closed) {
            break;
          }

          if (event.type === "text-delta") {
            emit({
              payload: {
                adapter: buildAdapterMetadata(event.providerSessionId),
                provider: { eventType: event.providerEventType },
                ...(event.text ? { text: event.text } : {}),
              },
              type: "message.delta",
            });
            continue;
          }

          if (event.type === "message-complete") {
            emit({
              payload: {
                adapter: buildAdapterMetadata(event.providerSessionId),
                provider: { eventType: event.providerEventType },
              },
              type: "message.completed",
            });
            continue;
          }

          emit({
            payload: {
              adapter: buildAdapterMetadata(event.providerSessionId),
              error: event.error ?? "Claude Code session failed.",
              provider: { eventType: event.providerEventType },
            },
            type: "session.failed",
          });
          complete();
        }
      } catch (error) {
        emit({
          payload: {
            error: error instanceof Error ? error.message : String(error),
          },
          type: "session.failed",
        });
        complete();
      } finally {
        activeRun = undefined;
        activeRunPromise = undefined;
      }
    },
    streamEvents() {
      return channel.stream();
    },
  };
}

function buildClaudeInstructions(
  context: BaseAgentAdapterSessionContext,
): string {
  const overlays = context.suit.manifest.prompt?.overlays ?? [];

  if (overlays.length === 0) {
    return "";
  }

  return overlays
    .map((overlay) => {
      const overlayPath = resolve(context.suit.rootDir, overlay.file);
      const overlayContent = readFileSync(overlayPath, "utf8").trim();

      return [`# Suit Overlay: ${overlay.file}`, overlayContent]
        .filter(Boolean)
        .join("\n\n");
    })
    .join("\n\n");
}

function resolveClaudeWorkingDirectory(
  context: BaseAgentAdapterSessionContext,
  env: AdapterEnvironment,
): string {
  const configuredWorkdir = readEnv(env, "AGENTSUIT_CLAUDE_WORKDIR");

  if (!configuredWorkdir) {
    return context.suit.rootDir;
  }

  return resolve(configuredWorkdir);
}

function buildClaudeMcpServers(
  context: BaseAgentAdapterSessionContext,
): Record<string, McpServerConfig> | undefined {
  const servers = context.mcpServers ?? [];

  if (servers.length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    servers.map((server) => [
      server.name,
      {
        command: server.command,
        ...(server.args ? { args: server.args } : {}),
        ...(server.env ? { env: server.env } : {}),
      },
    ]),
  );
}

function hasClaudeRuntimeCredentials(env: AdapterEnvironment): boolean {
  return CLAUDE_PROVIDER_ENVIRONMENT_VARIABLES.some((name) => {
    const value = readEnv(env, name);
    return Boolean(value);
  });
}

function readEnv(env: AdapterEnvironment, name: string): string | undefined {
  const value = env[name];
  return value && value.length > 0 ? value : undefined;
}

function createEventChannel<T>(): EventChannel<T> {
  const events: T[] = [];
  const pendingResolvers: Array<(result: IteratorResult<T>) => void> = [];
  let closed = false;

  return {
    complete() {
      closed = true;

      while (pendingResolvers.length > 0) {
        const resolve = pendingResolvers.shift();
        resolve?.({ done: true, value: undefined });
      }
    },
    emit(event) {
      if (closed) {
        return;
      }

      if (pendingResolvers.length > 0) {
        const resolve = pendingResolvers.shift();
        resolve?.({ done: false, value: event });
        return;
      }

      events.push(event);
    },
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

              return new Promise<IteratorResult<T>>((resolve) => {
                pendingResolvers.push(resolve);
              });
            },
          };
        },
      };
    },
  };
}
