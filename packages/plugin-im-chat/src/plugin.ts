import type {
  ExposurePlugin,
  ExposurePluginDefinition,
  PluginContext,
} from "@agentsuit/plugin-api";

import { readDiscordImConfig } from "./config";
import { createDefaultDiscordBotRuntime } from "./discord-runtime";
import { createDiscordRuntimeBridge } from "./runtime-bridge";
import {
  type CreateDiscordImPluginOptions,
  type DiscordBotRuntime,
  type DiscordImConfig,
  type DiscordRuntimeBridge,
  packageName,
} from "./types";

export function createDiscordImPlugin(
  options: CreateDiscordImPluginOptions = {},
): ExposurePlugin {
  const env = options.env ?? process.env;
  let config: DiscordImConfig | undefined;
  let context: PluginContext | undefined;
  let runtimeBridge: DiscordRuntimeBridge | undefined;
  let botRuntime: DiscordBotRuntime | undefined;

  return {
    name: "discord",
    async setup(pluginContext) {
      config = readDiscordImConfig(env);
      context = pluginContext;
      runtimeBridge = createDiscordRuntimeBridge({
        sessionApi: pluginContext.runtime.sessionApi,
      });
      botRuntime = await (
        options.createBotRuntime ?? createDefaultDiscordBotRuntime
      )({
        config,
        runtimeBridge,
      });
    },
    async start(startContext) {
      if (!context || !config || !runtimeBridge || !botRuntime) {
        throw new Error("Discord IM plugin must be setup before start().");
      }

      await botRuntime.start(startContext);
    },
    async stop() {
      await botRuntime?.stop();
    },
  };
}

export const discordImPluginDefinition: ExposurePluginDefinition = {
  async create(options) {
    return createDiscordImPlugin(
      options?.env
        ? {
            env: options.env,
          }
        : {},
    );
  },
  manifest: {
    adapter: "discord",
    capabilities: [
      "failure-cleanup",
      "streaming-text",
      "thread-session-mapping",
      "thread-stop-interrupt",
    ],
    config: {
      env: [
        {
          description: "Discord bot token",
          name: "DISCORD_BOT_TOKEN",
          required: true,
        },
        {
          description: "Discord application public key",
          name: "DISCORD_PUBLIC_KEY",
          required: true,
        },
        {
          description: "Discord application ID",
          name: "DISCORD_APPLICATION_ID",
          required: true,
        },
        {
          description: 'IM state backend. Current MVP only supports "memory".',
          name: "AGENTSUIT_IM_STATE",
        },
      ],
      validate(env) {
        readDiscordImConfig(env);
      },
    },
    expose: "im",
    name: packageName,
    requires: {
      host: "^0.1.0",
      pluginApi: "^0.1.0",
    },
    version: "0.1.0",
  },
};

export const exposurePluginDefinitions = [discordImPluginDefinition];
