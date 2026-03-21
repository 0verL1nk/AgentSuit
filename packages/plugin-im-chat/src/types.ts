import type { PluginStartContext } from "@agentsuit/plugin-api";

export const packageName = "@agentsuit/plugin-im-chat";

export type DiscordImState = "memory";
export type DiscordThreadMessageMode = "mention" | "subscribed";

export interface DiscordImConfig {
  adapter: "discord";
  applicationId: string;
  botToken: string;
  publicKey: string;
  state: DiscordImState;
}

export interface DiscordThread {
  id: string;
  post(content: string | AsyncIterable<string>): Promise<void>;
  subscribe(): Promise<void>;
}

export interface DiscordThreadMessage {
  mode: DiscordThreadMessageMode;
  text: string;
  thread: DiscordThread;
}

export interface DiscordRuntimeBridge {
  getSessionId(threadId: string): string | undefined;
  handleThreadMessage(message: DiscordThreadMessage): Promise<void>;
  stopThread(threadId: string): Promise<void>;
}

export interface DiscordBotRuntime {
  start(context: PluginStartContext): Promise<void>;
  stop(): Promise<void>;
}

export interface CreateDiscordBotRuntimeOptions {
  config: DiscordImConfig;
  runtimeBridge: DiscordRuntimeBridge;
}

export interface CreateDiscordImPluginOptions {
  createBotRuntime?: (
    options: CreateDiscordBotRuntimeOptions,
  ) => DiscordBotRuntime | Promise<DiscordBotRuntime>;
  env?: Record<string, string | undefined>;
}

export interface DiscordGatewayAdapter {
  startGatewayListener(
    options: { waitUntil(task: Promise<unknown>): void },
    durationMs?: number,
    abortSignal?: AbortSignal,
    webhookUrl?: string,
  ): Promise<Response>;
}

export interface DiscordGatewayLoop {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface CreateDiscordGatewayLoopOptions {
  adapter: DiscordGatewayAdapter;
  durationMs?: number;
  retryDelayMs?: number;
  webhookUrl?: string;
}
