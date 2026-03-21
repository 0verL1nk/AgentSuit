import type { AgentEvent, SessionApi } from "@agentsuit/runtime";

import type {
  DiscordRuntimeBridge,
  DiscordThread,
  DiscordThreadMessageMode,
} from "./types";

interface ActiveTurnState {
  interrupted: boolean;
}

interface RuntimeTurnResult {
  clearSession: boolean;
  failureMessage?: string;
}

interface PendingThreadTurn {
  message: {
    mode: DiscordThreadMessageMode;
    text: string;
    thread: DiscordThread;
  };
  rejectors: Array<(reason?: unknown) => void>;
  resolvers: Array<() => void>;
}

interface ThreadExecutionState {
  activeTurn: ActiveTurnState | undefined;
  pendingTurn: PendingThreadTurn | undefined;
  processing: boolean;
}

export function createDiscordRuntimeBridge(options: {
  sessionApi: SessionApi;
}): DiscordRuntimeBridge {
  const sessionByThread = new Map<string, string>();
  const executionByThread = new Map<string, ThreadExecutionState>();

  async function ensureSession(
    thread: DiscordThread,
    mode: DiscordThreadMessageMode,
  ): Promise<string> {
    const existingSessionId = sessionByThread.get(thread.id);

    if (existingSessionId) {
      return existingSessionId;
    }

    const session = await options.sessionApi.startSession();
    sessionByThread.set(thread.id, session.sessionId);

    if (mode === "mention") {
      await thread.subscribe();
    }

    return session.sessionId;
  }

  async function streamRuntimeTurn(
    sessionId: string,
    threadId: string,
    turnState: ActiveTurnState,
  ): Promise<{ result: RuntimeTurnResult; stream: AsyncIterable<string> }> {
    const outcome: RuntimeTurnResult = {
      clearSession: false,
    };

    async function* textStream(): AsyncIterable<string> {
      for await (const event of options.sessionApi.streamEvents(sessionId)) {
        if (getExecutionState(threadId).activeTurn !== turnState) {
          break;
        }

        if (event.type === "message.delta" && event.payload?.text) {
          if (turnState.interrupted) {
            break;
          }

          yield event.payload.text;
          continue;
        }

        if (event.type === "message.completed") {
          break;
        }

        if (event.type === "session.failed") {
          if (!turnState.interrupted) {
            outcome.clearSession = true;
            outcome.failureMessage = buildFailureMessage(event);
          }

          break;
        }
      }
    }

    return {
      result: outcome,
      stream: textStream(),
    };
  }

  function getExecutionState(threadId: string): ThreadExecutionState {
    const existingState = executionByThread.get(threadId);

    if (existingState) {
      return existingState;
    }

    const nextState: ThreadExecutionState = {
      activeTurn: undefined,
      pendingTurn: undefined,
      processing: false,
    };
    executionByThread.set(threadId, nextState);
    return nextState;
  }

  async function processThreadTurn(message: {
    mode: DiscordThreadMessageMode;
    text: string;
    thread: DiscordThread;
  }): Promise<void> {
    const sessionId = await ensureSession(message.thread, message.mode);
    const turnState: ActiveTurnState = {
      interrupted: false,
    };
    const executionState = getExecutionState(message.thread.id);
    executionState.activeTurn = turnState;

    const { result, stream } = await streamRuntimeTurn(
      sessionId,
      message.thread.id,
      turnState,
    );
    const postPromise = message.thread.post(stream);

    try {
      await options.sessionApi.sendInput(sessionId, {
        text: message.text,
        type: "text",
      });
      await postPromise;

      if (result.clearSession) {
        sessionByThread.delete(message.thread.id);
      }

      if (result.failureMessage) {
        await message.thread.post(result.failureMessage);
      }
    } finally {
      const latestState = getExecutionState(message.thread.id);
      if (latestState.activeTurn === turnState) {
        latestState.activeTurn = undefined;
      }
    }
  }

  async function drainThread(
    threadId: string,
    currentTurn: PendingThreadTurn,
  ): Promise<void> {
    const executionState = getExecutionState(threadId);
    let nextTurn: PendingThreadTurn | undefined = currentTurn;

    try {
      while (nextTurn) {
        const pendingTurn = nextTurn;
        executionState.pendingTurn = undefined;

        try {
          await processThreadTurn(pendingTurn.message);
          for (const resolve of pendingTurn.resolvers) {
            resolve();
          }
        } catch (error) {
          for (const reject of pendingTurn.rejectors) {
            reject(error);
          }
        }

        nextTurn = executionState.pendingTurn;
      }
    } finally {
      executionState.processing = false;

      if (
        !executionState.pendingTurn &&
        !executionState.activeTurn &&
        !sessionByThread.has(threadId)
      ) {
        executionByThread.delete(threadId);
      }
    }
  }

  return {
    getSessionId(threadId) {
      return sessionByThread.get(threadId);
    },
    async handleThreadMessage(message) {
      const executionState = getExecutionState(message.thread.id);

      return new Promise<void>((resolve, reject) => {
        if (!executionState.processing) {
          executionState.processing = true;

          const initialTurn: PendingThreadTurn = {
            message: {
              mode: message.mode,
              text: message.text,
              thread: message.thread,
            },
            rejectors: [reject],
            resolvers: [resolve],
          };

          void drainThread(message.thread.id, initialTurn);
          return;
        }

        if (executionState.pendingTurn) {
          executionState.pendingTurn.message.text = [
            executionState.pendingTurn.message.text,
            message.text,
          ]
            .filter(Boolean)
            .join("\n\n");
          executionState.pendingTurn.message.thread = message.thread;
          executionState.pendingTurn.resolvers.push(resolve);
          executionState.pendingTurn.rejectors.push(reject);
        } else {
          executionState.pendingTurn = {
            message: {
              mode: message.mode,
              text: message.text,
              thread: message.thread,
            },
            rejectors: [reject],
            resolvers: [resolve],
          };
        }
      });
    },
    async stopThread(threadId) {
      const sessionId = sessionByThread.get(threadId);

      if (!sessionId) {
        return;
      }

      const turnState = getExecutionState(threadId).activeTurn;
      if (turnState) {
        turnState.interrupted = true;
      }
      getExecutionState(threadId).activeTurn = undefined;

      await options.sessionApi.interrupt(sessionId);
    },
  };
}

function buildFailureMessage(event: AgentEvent): string {
  return `AgentSuit runtime session failed: ${event.payload?.error ?? "unknown error"}`;
}
