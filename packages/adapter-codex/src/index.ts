import { createBaseAgentAdapterContract } from "@agentsuit/adapter-api";

export const packageName = "@agentsuit/adapter-codex";

export function describePackage(): string {
  return `${packageName} bootstrap placeholder`;
}

export function createCodexAdapterDefinition() {
  return {
    ...createBaseAgentAdapterContract(),
    async detect() {
      return {
        available: false,
        message: "Codex adapter is not implemented yet.",
      };
    },
    name: "codex",
    version: "0.1.0-placeholder",
  };
}
