import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  createBaseAgentAdapterContract,
  describeAdapterApiPackage,
} from "../packages/adapter-api/src/index.ts";
import { createSuitScaffold, loadSuit } from "../packages/core/src/index.ts";
import {
  createExposurePluginContract,
  createExposurePluginRegistry,
  createPluginContextContract,
  createPluginStartContextContract,
  describePluginApiPackage,
} from "../packages/plugin-api/src/index.ts";
import { createRuntimeHost } from "../packages/runtime/src/index.ts";

const repoRoot = process.cwd();

describe("runtime service MVP", () => {
  test("exports dedicated public contract helpers for adapters and plugins", async () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));
    const adapterContract = createBaseAgentAdapterContract();
    const pluginContract = createExposurePluginContract();
    const pluginContext = createPluginContextContract();
    const pluginStartContext = createPluginStartContextContract();
    const adapterSession = await adapterContract.createSession({
      runtimeSessionId: "runtime-session",
      suit,
    });

    expect(describeAdapterApiPackage()).toContain("@agentsuit/adapter-api");
    expect(describePluginApiPackage()).toContain("@agentsuit/plugin-api");
    expect(Object.keys(adapterContract)).toEqual([
      "capabilities",
      "createSession",
      "detect",
      "name",
      "version",
    ]);
    expect(Object.keys(adapterSession)).toEqual([
      "close",
      "interrupt",
      "sendInput",
      "streamEvents",
    ]);
    expect(Object.keys(pluginContract)).toEqual([
      "name",
      "setup",
      "start",
      "stop",
    ]);
    expect(pluginContext.runtime.eventTypes).toEqual([
      "message.completed",
      "message.delta",
      "session.completed",
      "session.failed",
      "session.started",
    ]);
    expect(Object.keys(pluginContext.runtime.sessionApi)).toEqual([
      "closeSession",
      "healthCheck",
      "interrupt",
      "sendInput",
      "startSession",
      "streamEvents",
    ]);
    expect(pluginStartContext.runtime.report.healthUrl).toContain("/healthz");
  });

  test("registers exposure plugins by expose kind and adapter key", async () => {
    const registry = createExposurePluginRegistry();

    registry.register({
      async create() {
        return createExposurePluginContract();
      },
      manifest: {
        adapter: "discord",
        expose: "im",
        name: "@agentsuit/plugin-test",
        requires: {
          host: "^0.1.0",
          pluginApi: "^0.1.0",
        },
        version: "0.1.0",
      },
    });

    expect(registry.list()).toHaveLength(1);
    expect(registry.get("im", "discord")?.manifest.adapter).toBe("discord");
    expect(() =>
      registry.register({
        async create() {
          return createExposurePluginContract();
        },
        manifest: {
          adapter: "discord",
          expose: "im",
          name: "@agentsuit/plugin-test-duplicate",
          requires: {
            host: "^0.1.0",
            pluginApi: "^0.1.0",
          },
          version: "0.1.0",
        },
      }),
    ).toThrow('Exposure plugin "im/discord" is already registered.');
  });

  test("starts an adapter-backed runtime host with health checks and session events", async () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));
    const host = createRuntimeHost({
      host: "127.0.0.1",
      port: 0,
      suit,
    });

    const report = await host.start();

    expect(report.suitName).toBe("minimal-starter");
    expect(report.adapterName).toBe("mock");
    expect(report.healthUrl).toContain("/healthz");

    const healthResponse = await fetch(report.healthUrl);
    const healthJson = await healthResponse.json();

    expect(healthResponse.status).toBe(200);
    expect(healthJson).toEqual({
      ok: true,
      status: "alive",
      suitName: "minimal-starter",
    });

    const session = await host.sessionApi.startSession();
    const events = host.sessionApi.streamEvents(session.sessionId);

    await host.sessionApi.sendInput(session.sessionId, {
      text: "hello runtime",
      type: "text",
    });

    const received = [];
    for await (const event of events) {
      received.push(event);
      if (event.type === "message.completed") {
        break;
      }
    }

    expect(received.map((event) => event.type)).toEqual([
      "session.started",
      "message.delta",
      "message.completed",
    ]);
    expect(received[0]?.payload?.adapter?.name).toBe("mock");
    expect(received[1]?.payload?.adapter?.name).toBe("mock");

    await host.stop();
  });
});
