import { createBaseAgentAdapterContract } from "@agentsuit/adapter-api";

export const packageName = "@agentsuit/adapter-openclaw";

export function describePackage(): string {
  return `${packageName} bootstrap placeholder`;
}

export function createOpenClawAdapterDefinition() {
  return {
    ...createBaseAgentAdapterContract(),
    async detect() {
      return {
        available: false,
        message: "OpenClaw adapter is not implemented yet.",
      };
    },
    name: "openclaw",
    version: "0.1.0-placeholder",
  };
}
