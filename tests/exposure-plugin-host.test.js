import { describe, expect, test } from "bun:test";

import {
  createExposurePluginContract,
  createExposurePluginHost,
  createPluginContextContract,
  createPluginStartContextContract,
  exposureHostVersion,
  pluginApiVersion,
} from "../packages/plugin-api/src/index.ts";

function createDefinition({
  adapter = "discord",
  expose = "im",
  name = "@agentsuit/plugin-test",
  version = "0.1.0",
  requires,
  create,
} = {}) {
  return {
    create:
      create ??
      (async () => {
        return createExposurePluginContract();
      }),
    manifest: {
      adapter,
      capabilities: ["streaming-text"],
      expose,
      name,
      requires: {
        host: `^${exposureHostVersion}`,
        pluginApi: `^${pluginApiVersion}`,
        ...requires,
      },
      version,
    },
  };
}

describe("exposure plugin host", () => {
  test("discovers plugin definitions from explicit sources and resolves by expose/adapter", async () => {
    const host = createExposurePluginHost({
      sources: [
        {
          id: "test-source",
          async load() {
            return {
              exposurePluginDefinitions: [createDefinition()],
            };
          },
        },
      ],
    });

    const definitions = await host.discover();
    const resolved = await host.resolve("im", "discord");

    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.manifest.name).toBe("@agentsuit/plugin-test");
    expect(resolved.manifest.adapter).toBe("discord");
  });

  test("fails deterministically for duplicate expose/adapter claims", async () => {
    const host = createExposurePluginHost({
      sources: [
        {
          id: "first-source",
          async load() {
            return {
              exposurePluginDefinitions: [createDefinition()],
            };
          },
        },
        {
          id: "second-source",
          async load() {
            return {
              exposurePluginDefinitions: [createDefinition()],
            };
          },
        },
      ],
    });

    await expect(host.discover()).rejects.toThrow(
      'Exposure plugin "im/discord" is already registered.',
    );
  });

  test("fails deterministically for incompatible plugin requirements before instantiation", async () => {
    const host = createExposurePluginHost({
      sources: [
        {
          id: "incompatible-source",
          async load() {
            return {
              exposurePluginDefinitions: [
                createDefinition({
                  requires: {
                    pluginApi: "^9.0.0",
                  },
                }),
              ],
            };
          },
        },
      ],
    });

    await expect(host.discover()).rejects.toThrow(
      'Exposure plugin "@agentsuit/plugin-test" is incompatible with plugin API version',
    );
  });

  test("rolls back already-started plugins when a later plugin start fails", async () => {
    const calls = [];
    const host = createExposurePluginHost({
      env: {},
      sources: [
        {
          id: "good-source",
          async load() {
            return {
              exposurePluginDefinitions: [
                createDefinition({
                  adapter: "good",
                  create: async () => ({
                    name: "good-plugin",
                    async setup() {
                      calls.push("good-setup");
                    },
                    async start() {
                      calls.push("good-start");
                    },
                    async stop() {
                      calls.push("good-stop");
                    },
                  }),
                }),
              ],
            };
          },
        },
        {
          id: "bad-source",
          async load() {
            return {
              exposurePluginDefinitions: [
                createDefinition({
                  adapter: "bad",
                  create: async () => ({
                    name: "bad-plugin",
                    async setup() {
                      calls.push("bad-setup");
                    },
                    async start() {
                      calls.push("bad-start");
                      throw new Error("bad plugin start failed");
                    },
                    async stop() {
                      calls.push("bad-stop");
                    },
                  }),
                }),
              ],
            };
          },
        },
      ],
    });

    await host.discover();

    await expect(
      host.startPlugins(
        [
          { adapter: "good", expose: "im" },
          { adapter: "bad", expose: "im" },
        ],
        {
          pluginContext: createPluginContextContract(),
          startContext: createPluginStartContextContract(),
        },
      ),
    ).rejects.toThrow("bad plugin start failed");

    expect(calls).toEqual([
      "good-setup",
      "good-start",
      "bad-setup",
      "bad-start",
      "good-stop",
    ]);
  });
});
