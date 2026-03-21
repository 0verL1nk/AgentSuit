import { randomUUID } from "node:crypto";
import {
  type IncomingMessage,
  type ServerResponse,
  createServer,
} from "node:http";

import type { LoadedSuit } from "@agentsuit/core";

export const packageName = "@agentsuit/runtime";

export const SUPPORTED_RUNTIME_EVENT_TYPES = [
  "message.completed",
  "message.delta",
  "session.completed",
  "session.failed",
  "session.started",
] as const;

export type RuntimeEventType = (typeof SUPPORTED_RUNTIME_EVENT_TYPES)[number];

export type RuntimeAdapterCapabilitySupport =
  | "degraded"
  | "native"
  | "plugin-backed"
  | "unsupported";

export interface SessionHandle {
  createdAt: string;
  sessionId: string;
}

export interface UserInput {
  text: string;
  type: "text";
}

export interface AgentEventPayload {
  adapter?: {
    name: string;
    providerSessionId?: string;
  };
  error?: string;
  provider?: {
    eventType?: string;
  };
  text?: string;
}

export interface AgentEvent {
  payload?: AgentEventPayload;
  sessionId: string;
  timestamp: string;
  type: RuntimeEventType;
}

export interface HealthStatus {
  ok: boolean;
  status: "alive";
  suitName: string;
}

export interface SessionApi {
  closeSession(sessionId: string): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  interrupt(sessionId: string): Promise<void>;
  sendInput(sessionId: string, input: UserInput): Promise<void>;
  startSession(): Promise<SessionHandle>;
  streamEvents(sessionId: string): AsyncIterable<AgentEvent>;
}

export interface RuntimeAdapterAvailability {
  available: boolean;
  message?: string;
}

export interface RuntimeAdapterCapabilityStatus {
  details?: string;
  support: RuntimeAdapterCapabilitySupport;
}

export interface RuntimeAdapterSessionContext {
  mcpServers?: RuntimeMcpServerDefinition[];
  runtimeSessionId: string;
  suit: LoadedSuit;
}

export interface RuntimeMcpServerDefinition {
  args?: string[];
  command: string;
  env?: Record<string, string>;
  name: string;
}

export interface RuntimeAdapterSession {
  close(): Promise<void>;
  interrupt(): Promise<void>;
  sendInput(input: UserInput): Promise<void>;
  streamEvents(): AsyncIterable<AgentEvent>;
}

export interface RuntimeAdapterDefinition {
  capabilities(): Promise<Record<string, RuntimeAdapterCapabilityStatus>>;
  createSession(
    context: RuntimeAdapterSessionContext,
  ): Promise<RuntimeAdapterSession>;
  detect(): Promise<RuntimeAdapterAvailability>;
  name: string;
  version: string;
}

export interface RuntimeAdapterRegistry {
  get(name: string): RuntimeAdapterDefinition | undefined;
  list(): RuntimeAdapterDefinition[];
  register(adapter: RuntimeAdapterDefinition): void;
}

export interface ServeReport {
  adapterName: string;
  healthUrl: string;
  host: string;
  instanceId: string;
  port: number;
  startedAt: string;
  suitName: string;
}

export interface SessionEngine {
  sendInput(sessionId: string, input: UserInput): Promise<AgentEvent[]>;
}

export interface RuntimeHostOptions {
  adapterName?: string;
  adapterRegistry?: RuntimeAdapterRegistry;
  host?: string;
  mcpServers?: RuntimeMcpServerDefinition[];
  port?: number;
  sessionEngine?: SessionEngine;
  suit: LoadedSuit;
}

interface EventChannel<T> {
  complete(): void;
  emit(event: T): void;
  stream(): AsyncIterable<T>;
}

interface SessionState {
  adapterName: string;
  adapterSession: RuntimeAdapterSession;
  channel: EventChannel<AgentEvent>;
  closed: boolean;
}

export interface RuntimeHost {
  sessionApi: SessionApi;
  start(): Promise<ServeReport>;
  stop(): Promise<void>;
}

export function describePackage(): string {
  return `${packageName} runtime host MVP`;
}

export function createSessionApiContract(): SessionApi {
  return {
    async closeSession() {},
    async healthCheck() {
      return {
        ok: true,
        status: "alive",
        suitName: "placeholder-suit",
      };
    },
    async interrupt() {},
    async sendInput() {},
    async startSession() {
      return {
        createdAt: new Date().toISOString(),
        sessionId: "placeholder-session",
      };
    },
    async *streamEvents() {},
  };
}

export function createRuntimeAdapterRegistry(): RuntimeAdapterRegistry {
  const adapters = new Map<string, RuntimeAdapterDefinition>();

  return {
    get(name) {
      return adapters.get(name);
    },
    list() {
      return [...adapters.values()];
    },
    register(adapter) {
      if (adapters.has(adapter.name)) {
        throw new Error(
          `Runtime adapter "${adapter.name}" is already registered.`,
        );
      }

      adapters.set(adapter.name, adapter);
    },
  };
}

export function createMockSessionEngine(): SessionEngine {
  return {
    async sendInput(sessionId, input) {
      const timestamp = new Date().toISOString();

      return [
        {
          payload: { text: input.text },
          sessionId,
          timestamp,
          type: "message.delta",
        },
        {
          sessionId,
          timestamp,
          type: "message.completed",
        },
      ];
    },
  };
}

export function createMockRuntimeAdapterDefinition(
  sessionEngine: SessionEngine = createMockSessionEngine(),
): RuntimeAdapterDefinition {
  return {
    async capabilities() {
      return {
        sessionLifecycle: {
          details: "In-process mock runtime session implementation.",
          support: "native",
        },
      };
    },
    async createSession(context) {
      const channel = createEventChannel<AgentEvent>();

      return {
        async close() {
          channel.emit({
            sessionId: context.runtimeSessionId,
            timestamp: new Date().toISOString(),
            type: "session.completed",
          });
          channel.complete();
        },
        async interrupt() {
          channel.emit({
            payload: { error: "interrupted" },
            sessionId: context.runtimeSessionId,
            timestamp: new Date().toISOString(),
            type: "session.failed",
          });
          channel.complete();
        },
        async sendInput(input) {
          const events = await sessionEngine.sendInput(
            context.runtimeSessionId,
            input,
          );

          for (const event of events) {
            channel.emit(event);
          }
        },
        streamEvents() {
          return channel.stream();
        },
      };
    },
    async detect() {
      return { available: true };
    },
    name: "mock",
    version: "0.1.0",
  };
}

export function createRuntimeHost(options: RuntimeHostOptions): RuntimeHost {
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? 0;
  const adapterRegistry =
    options.adapterRegistry ?? createRuntimeAdapterRegistry();
  const selectedAdapterName = options.adapterName ?? "mock";
  const status: HealthStatus = {
    ok: true,
    status: "alive",
    suitName: options.suit.manifest.metadata.name,
  };

  if (!adapterRegistry.get("mock")) {
    adapterRegistry.register(
      createMockRuntimeAdapterDefinition(options.sessionEngine),
    );
  }

  const sessions = new Map<string, SessionState>();

  let activePort = requestedPort;
  let boundAdapter: RuntimeAdapterDefinition | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  let report: ServeReport | undefined;

  function getSession(sessionId: string): SessionState {
    const session = sessions.get(sessionId);

    if (!session) {
      throw new Error(`Unknown session "${sessionId}".`);
    }

    return session;
  }

  function normalizeEvent(
    sessionId: string,
    adapterName: string,
    event: AgentEvent,
  ): AgentEvent {
    return {
      ...event,
      payload: {
        ...event.payload,
        adapter: {
          ...event.payload?.adapter,
          name: adapterName,
        },
      },
      sessionId,
    };
  }

  function emitEvent(sessionId: string, event: AgentEvent): void {
    const session = getSession(sessionId);

    if (session.closed) {
      return;
    }

    const normalizedEvent = normalizeEvent(
      sessionId,
      session.adapterName,
      event,
    );
    session.channel.emit(normalizedEvent);

    if (
      normalizedEvent.type === "session.completed" ||
      normalizedEvent.type === "session.failed"
    ) {
      session.closed = true;
      session.channel.complete();
    }
  }

  async function bindSelectedAdapter(): Promise<RuntimeAdapterDefinition> {
    if (boundAdapter) {
      return boundAdapter;
    }

    const adapter = adapterRegistry.get(selectedAdapterName);

    if (!adapter) {
      throw new Error(`Unknown runtime adapter "${selectedAdapterName}".`);
    }

    const detection = await adapter.detect();

    if (!detection.available) {
      const suffix = detection.message ? `: ${detection.message}` : ".";
      throw new Error(
        `Runtime adapter "${selectedAdapterName}" is not available${suffix}`,
      );
    }

    boundAdapter = adapter;
    return adapter;
  }

  async function pumpAdapterEvents(sessionId: string): Promise<void> {
    const session = getSession(sessionId);

    try {
      for await (const event of session.adapterSession.streamEvents()) {
        emitEvent(sessionId, event);

        if (getSession(sessionId).closed) {
          break;
        }
      }
    } catch (error) {
      if (!sessions.has(sessionId) || getSession(sessionId).closed) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      emitEvent(sessionId, {
        payload: { error: message },
        sessionId,
        timestamp: new Date().toISOString(),
        type: "session.failed",
      });
    }
  }

  async function startSession(): Promise<SessionHandle> {
    const adapter = await bindSelectedAdapter();
    const sessionId = randomUUID();
    const createdAt = new Date().toISOString();

    let adapterSession: RuntimeAdapterSession;

    try {
      const sessionContext: RuntimeAdapterSessionContext = {
        runtimeSessionId: sessionId,
        suit: options.suit,
      };

      if (options.mcpServers) {
        sessionContext.mcpServers = options.mcpServers;
      }

      adapterSession = await adapter.createSession(sessionContext);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to start runtime session with adapter "${adapter.name}": ${message}`,
      );
    }

    sessions.set(sessionId, {
      adapterName: adapter.name,
      adapterSession,
      channel: createEventChannel<AgentEvent>(),
      closed: false,
    });

    emitEvent(sessionId, {
      sessionId,
      timestamp: createdAt,
      type: "session.started",
    });

    void pumpAdapterEvents(sessionId);

    return {
      createdAt,
      sessionId,
    };
  }

  async function sendInput(sessionId: string, input: UserInput): Promise<void> {
    const session = getSession(sessionId);
    await session.adapterSession.sendInput(input);
  }

  async function interrupt(sessionId: string): Promise<void> {
    const session = getSession(sessionId);

    await session.adapterSession.interrupt();

    if (!session.closed) {
      emitEvent(sessionId, {
        payload: { error: "interrupted" },
        sessionId,
        timestamp: new Date().toISOString(),
        type: "session.failed",
      });
    }
  }

  async function closeSession(sessionId: string): Promise<void> {
    const session = getSession(sessionId);

    await session.adapterSession.close();

    if (!session.closed) {
      emitEvent(sessionId, {
        sessionId,
        timestamp: new Date().toISOString(),
        type: "session.completed",
      });
    }
  }

  function streamEvents(sessionId: string): AsyncIterable<AgentEvent> {
    return getSession(sessionId).channel.stream();
  }

  async function healthCheck(): Promise<HealthStatus> {
    return status;
  }

  function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): void {
    if (request.url !== "/healthz") {
      response.statusCode = 404;
      response.end("Not Found");
      return;
    }

    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(status));
  }

  async function start(): Promise<ServeReport> {
    if (server && report) {
      return report;
    }

    const adapter = await bindSelectedAdapter();
    server = createServer(handleRequest);

    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.listen(requestedPort, host, () => {
        resolve();
      });
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to determine runtime listen address.");
    }

    activePort = address.port;
    report = {
      adapterName: adapter.name,
      healthUrl: `http://${host}:${activePort}/healthz`,
      host,
      instanceId: randomUUID(),
      port: activePort,
      startedAt: new Date().toISOString(),
      suitName: options.suit.manifest.metadata.name,
    };

    return report;
  }

  async function stop(): Promise<void> {
    for (const [sessionId, session] of sessions) {
      if (!session.closed) {
        await closeSession(sessionId);
      }
      sessions.delete(sessionId);
    }

    if (!server) {
      return;
    }

    const closingServer = server;
    server = undefined;
    report = undefined;

    await new Promise<void>((resolve, reject) => {
      closingServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  return {
    sessionApi: {
      closeSession,
      healthCheck,
      interrupt,
      sendInput,
      startSession,
      streamEvents,
    },
    start,
    stop,
  };
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
