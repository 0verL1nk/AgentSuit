import { createDiscordGatewayLoop } from "./gateway-loop";
import type {
  CreateDiscordBotRuntimeOptions,
  DiscordBotRuntime,
  DiscordGatewayAdapter,
  DiscordThread,
} from "./types";

export async function createDefaultDiscordBotRuntime(
  options: CreateDiscordBotRuntimeOptions,
): Promise<DiscordBotRuntime> {
  const [{ Chat }, { createDiscordAdapter }, { createMemoryState }] =
    await Promise.all([
      import("chat"),
      import("@chat-adapter/discord"),
      import("@chat-adapter/state-memory"),
    ]);

  const chat = new Chat({
    adapters: {
      discord: createDiscordAdapter({
        applicationId: options.config.applicationId,
        botToken: options.config.botToken,
        publicKey: options.config.publicKey,
      }),
    },
    state: createMemoryState(),
    userName: "agentsuit",
  });
  const gatewayLoop = createDiscordGatewayLoop({
    adapter: chat.getAdapter("discord") as DiscordGatewayAdapter,
  });

  chat.onNewMention?.(async (thread, message) => {
    const normalizedThread = toDiscordThread(thread);
    const text = readThreadMessageText(message);

    if (!text) {
      return;
    }

    await options.runtimeBridge.handleThreadMessage({
      mode: "mention",
      text,
      thread: normalizedThread,
    });
  });

  chat.onSubscribedMessage?.(async (thread, message) => {
    const normalizedThread = toDiscordThread(thread);
    const text = readThreadMessageText(message);

    if (!text) {
      return;
    }

    if (isStopCommand(text)) {
      await options.runtimeBridge.stopThread(normalizedThread.id);
      return;
    }

    await options.runtimeBridge.handleThreadMessage({
      mode: "subscribed",
      text,
      thread: normalizedThread,
    });
  });

  return {
    async start() {
      await chat.initialize?.();
      await gatewayLoop.start();
    },
    async stop() {
      await gatewayLoop.stop();
      await chat.shutdown?.();
    },
  };
}

function isStopCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === "/stop" || normalized === "stop";
}

function readThreadMessageText(message: unknown): string {
  if (
    message &&
    typeof message === "object" &&
    "text" in message &&
    typeof message.text === "string"
  ) {
    return message.text;
  }

  return "";
}

function toDiscordThread(thread: unknown): DiscordThread {
  if (!isChatSdkThreadLike(thread)) {
    throw new Error(
      "Failed to initialize Discord IM plugin: Chat SDK thread shape is invalid.",
    );
  }

  return {
    id: thread.id,
    async post(content) {
      await thread.post(content);
    },
    async subscribe() {
      await thread.subscribe();
    },
  };
}

interface ChatSdkThreadLike {
  id: string;
  post(content: string | AsyncIterable<string>): Promise<unknown>;
  subscribe(): Promise<unknown>;
}

function isChatSdkThreadLike(thread: unknown): thread is ChatSdkThreadLike {
  return (
    !!thread &&
    typeof thread === "object" &&
    "id" in thread &&
    typeof thread.id === "string" &&
    "post" in thread &&
    typeof thread.post === "function" &&
    "subscribe" in thread &&
    typeof thread.subscribe === "function"
  );
}
