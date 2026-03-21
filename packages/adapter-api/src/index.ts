import type { LoadedSuit } from "@agentsuit/core";
import type {
  AgentEvent,
  RuntimeAdapterAvailability,
  RuntimeAdapterCapabilityStatus,
  RuntimeMcpServerDefinition,
  UserInput,
} from "@agentsuit/runtime";

export const packageName = "@agentsuit/adapter-api";

export interface BaseAgentAdapterSession {
  close(): Promise<void>;
  interrupt(): Promise<void>;
  sendInput(input: UserInput): Promise<void>;
  streamEvents(): AsyncIterable<AgentEvent>;
}

export interface BaseAgentAdapterSessionContext {
  mcpServers?: RuntimeMcpServerDefinition[];
  runtimeSessionId: string;
  suit: LoadedSuit;
}

export interface BaseAgentAdapter {
  capabilities(): Promise<Record<string, RuntimeAdapterCapabilityStatus>>;
  createSession(
    context: BaseAgentAdapterSessionContext,
  ): Promise<BaseAgentAdapterSession>;
  detect(): Promise<RuntimeAdapterAvailability>;
  name: string;
  version: string;
}

export function describeAdapterApiPackage(): string {
  return `${packageName} public adapter contracts`;
}

export function createBaseAgentAdapterContract(): BaseAgentAdapter {
  return {
    async capabilities() {
      return {
        sessionLifecycle: {
          details: "Placeholder contract session implementation.",
          support: "degraded",
        },
      };
    },
    async createSession(context) {
      let closed = false;
      const events: AgentEvent[] = [];
      const pendingResolvers: Array<
        (result: IteratorResult<AgentEvent>) => void
      > = [];

      function emit(event: AgentEvent): void {
        if (closed) {
          return;
        }

        if (pendingResolvers.length > 0) {
          const resolve = pendingResolvers.shift();
          resolve?.({ done: false, value: event });
          return;
        }

        events.push(event);
      }

      function complete(): void {
        closed = true;

        while (pendingResolvers.length > 0) {
          const resolve = pendingResolvers.shift();
          resolve?.({ done: true, value: undefined });
        }
      }

      return {
        async close() {
          emit({
            sessionId: context.runtimeSessionId,
            timestamp: new Date().toISOString(),
            type: "session.completed",
          });
          complete();
        },
        async interrupt() {
          emit({
            payload: { error: "placeholder interrupt" },
            sessionId: context.runtimeSessionId,
            timestamp: new Date().toISOString(),
            type: "session.failed",
          });
          complete();
        },
        async sendInput(input) {
          const timestamp = new Date().toISOString();

          emit({
            payload: { text: input.text },
            sessionId: context.runtimeSessionId,
            timestamp,
            type: "message.delta",
          });
          emit({
            sessionId: context.runtimeSessionId,
            timestamp,
            type: "message.completed",
          });
        },
        streamEvents() {
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

                  return new Promise<IteratorResult<AgentEvent>>((resolve) => {
                    pendingResolvers.push(resolve);
                  });
                },
              };
            },
          };
        },
      };
    },
    async detect() {
      return {
        available: false,
        message: "placeholder adapter contract",
      };
    },
    name: "placeholder",
    version: "0.0.0-placeholder",
  };
}
