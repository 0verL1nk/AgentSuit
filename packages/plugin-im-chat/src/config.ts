import { type DiscordImConfig, packageName } from "./types";

export function describePackage(): string {
  return `${packageName} Discord IM exposure plugin`;
}

export function readDiscordImConfig(
  env: Record<string, string | undefined> = process.env,
): DiscordImConfig {
  const applicationId = env.DISCORD_APPLICATION_ID?.trim();
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  const publicKey = env.DISCORD_PUBLIC_KEY?.trim();

  if (!botToken) {
    throw new Error(
      'Missing Discord IM configuration: set "DISCORD_BOT_TOKEN".',
    );
  }

  if (!publicKey) {
    throw new Error(
      'Missing Discord IM configuration: set "DISCORD_PUBLIC_KEY".',
    );
  }

  if (!applicationId) {
    throw new Error(
      'Missing Discord IM configuration: set "DISCORD_APPLICATION_ID".',
    );
  }

  const configuredState = env.AGENTSUIT_IM_STATE?.trim();
  const state =
    configuredState && configuredState.length > 0 ? configuredState : "memory";

  if (state !== "memory") {
    throw new Error(
      `Unsupported IM state "${state}". Only "memory" is currently supported.`,
    );
  }

  return {
    adapter: "discord",
    applicationId,
    botToken,
    publicKey,
    state,
  };
}
