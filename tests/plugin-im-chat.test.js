import { describe, expect, test } from "bun:test";

import { createPluginContextContract } from "../packages/plugin-api/src/index.ts";
import {
  createDiscordGatewayLoop,
  createDiscordImPlugin,
  createDiscordRuntimeBridge,
  describePackage,
  discordImPluginDefinition,
  exposurePluginDefinitions,
  readDiscordImConfig,
} from "../packages/plugin-im-chat/src/index.ts";

function createEventChannel() {
  const events = [];
  const pendingResolvers = [];
  let closed = false;

  return {
    complete() {
      closed = true;

      while (pendingResolvers.length > 0) {
        const resolve = pendingResolvers.shift();
        resolve?.({ done: true, value: undefined });
      }
    },
    emit(event) {
      if (pendingResolvers.length > 0) {
        const resolve = pendingResolvers.shift();
        resolve?.({ done: false, value: event });
        return;
      }

      events.push(event);
    },
    stream() {
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

              return new Promise((resolve) => {
                pendingResolvers.push(resolve);
              });
            },
          };
        },
      };
    },
  };
}

function createRuntimeSessionApiStub() {
  const calls = {
    interrupt: [],
    sendInput: [],
    startSession: [],
  };
  const channels = new Map();

  return {
    calls,
    complete(sessionId) {
      channels.get(sessionId)?.complete();
    },
    emit(sessionId, event) {
      channels.get(sessionId)?.emit({
        sessionId,
        timestamp: new Date().toISOString(),
        ...event,
      });
    },
    sessionApi: {
      async closeSession() {},
      async healthCheck() {
        return {
          ok: true,
          status: "alive",
          suitName: "test-suit",
        };
      },
      async interrupt(sessionId) {
        calls.interrupt.push(sessionId);
      },
      async sendInput(sessionId, input) {
        calls.sendInput.push({ input, sessionId });
      },
      async startSession() {
        const sessionId = `session-${calls.startSession.length + 1}`;
        calls.startSession.push(sessionId);
        channels.set(sessionId, createEventChannel());

        return {
          createdAt: new Date().toISOString(),
          sessionId,
        };
      },
      streamEvents(sessionId) {
        return channels.get(sessionId)?.stream();
      },
    },
  };
}

function createFakeThread(id = "discord-thread-1") {
  const posts = [];
  const chunkLog = [];
  const chunkWaiters = [];
  let subscribed = false;
  let activeStreamDone = Promise.resolve();
  let activeStreamResolve = () => {};

  return {
    get chunkLog() {
      return chunkLog;
    },
    get posts() {
      return posts;
    },
    get subscribed() {
      return subscribed;
    },
    async post(content) {
      if (typeof content === "string") {
        posts.push(content);
        return;
      }

      let collected = "";
      activeStreamDone = new Promise((resolve) => {
        activeStreamResolve = resolve;
      });

      for await (const chunk of content) {
        chunkLog.push(chunk);
        while (chunkWaiters.length > 0) {
          const waiter = chunkWaiters.shift();
          waiter?.();
        }
        collected += chunk;
      }

      posts.push(collected);
      activeStreamResolve();
    },
    id,
    async subscribe() {
      subscribed = true;
    },
    waitForStreamToFinish() {
      return activeStreamDone;
    },
    waitForChunkCount(targetCount) {
      if (chunkLog.length >= targetCount) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        chunkWaiters.push(() => {
          if (chunkLog.length >= targetCount) {
            resolve();
            return;
          }

          chunkWaiters.push(resolve);
        });
      });
    },
  };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve() {
      resolve?.();
    },
  };
}

describe("plugin-im-chat", () => {
  test("starts the Discord Gateway listener in the background", async () => {
    const calls = [];
    const listener = createDeferred();
    const gateway = createDiscordGatewayLoop({
      adapter: {
        async startGatewayListener(options, durationMs, abortSignal) {
          calls.push({ abortSignal, durationMs });
          options.waitUntil(listener.promise);
          return new Response(null, { status: 200 });
        },
      },
      durationMs: 25,
    });

    await gateway.start();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.durationMs).toBe(25);

    listener.resolve();
    await gateway.stop();
  });

  test("restarts the Discord Gateway listener after one listener window ends and aborts on stop", async () => {
    const calls = [];
    const listeners = [];
    const gateway = createDiscordGatewayLoop({
      adapter: {
        async startGatewayListener(options, durationMs, abortSignal) {
          const listener = createDeferred();
          listeners.push(listener);
          calls.push({ abortSignal, durationMs });
          abortSignal?.addEventListener(
            "abort",
            () => {
              listener.resolve();
            },
            { once: true },
          );
          options.waitUntil(listener.promise);
          return new Response(null, { status: 200 });
        },
      },
      durationMs: 25,
    });

    await gateway.start();
    expect(calls).toHaveLength(1);

    listeners[0]?.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toHaveLength(2);
    expect(calls[0]?.abortSignal.aborted).toBe(false);
    expect(calls[1]?.abortSignal.aborted).toBe(false);

    await gateway.stop();

    expect(calls[1]?.abortSignal.aborted).toBe(true);
  });

  test("parses Discord IM configuration from environment variables", () => {
    expect(describePackage()).toContain("@agentsuit/plugin-im-chat");
    expect(
      readDiscordImConfig({
        AGENTSUIT_IM_STATE: "memory",
        DISCORD_APPLICATION_ID: "discord-application-id",
        DISCORD_BOT_TOKEN: "discord-token",
        DISCORD_PUBLIC_KEY: "discord-public-key",
      }),
    ).toEqual({
      adapter: "discord",
      applicationId: "discord-application-id",
      botToken: "discord-token",
      publicKey: "discord-public-key",
      state: "memory",
    });
    expect(() => readDiscordImConfig({})).toThrow(
      'Missing Discord IM configuration: set "DISCORD_BOT_TOKEN".',
    );
    expect(() =>
      readDiscordImConfig({
        DISCORD_BOT_TOKEN: "discord-token",
      }),
    ).toThrow('Missing Discord IM configuration: set "DISCORD_PUBLIC_KEY".');
    expect(() =>
      readDiscordImConfig({
        DISCORD_BOT_TOKEN: "discord-token",
        DISCORD_PUBLIC_KEY: "discord-public-key",
      }),
    ).toThrow(
      'Missing Discord IM configuration: set "DISCORD_APPLICATION_ID".',
    );
  });

  test("reuses one runtime session per Discord thread", async () => {
    const runtime = createRuntimeSessionApiStub();
    const bridge = createDiscordRuntimeBridge({
      sessionApi: runtime.sessionApi,
    });
    const thread = createFakeThread();

    const firstTurn = bridge.handleThreadMessage({
      mode: "mention",
      text: "hello from discord",
      thread,
    });
    const firstSessionId = runtime.calls.startSession[0];

    runtime.emit(firstSessionId, {
      payload: { text: "hello" },
      type: "message.delta",
    });
    runtime.emit(firstSessionId, {
      type: "message.completed",
    });

    await firstTurn;

    const secondTurn = bridge.handleThreadMessage({
      mode: "subscribed",
      text: "continue the thread",
      thread,
    });

    runtime.emit(firstSessionId, {
      payload: { text: " again" },
      type: "message.delta",
    });
    runtime.emit(firstSessionId, {
      type: "message.completed",
    });

    await secondTurn;

    expect(thread.subscribed).toBe(true);
    expect(runtime.calls.startSession).toEqual([firstSessionId]);
    expect(runtime.calls.sendInput).toEqual([
      {
        input: { text: "hello from discord", type: "text" },
        sessionId: firstSessionId,
      },
      {
        input: { text: "continue the thread", type: "text" },
        sessionId: firstSessionId,
      },
    ]);
    expect(thread.posts).toEqual(["hello", " again"]);
  });

  test("keeps different Discord threads isolated with distinct runtime sessions", async () => {
    const runtime = createRuntimeSessionApiStub();
    const bridge = createDiscordRuntimeBridge({
      sessionApi: runtime.sessionApi,
    });
    const alphaThread = createFakeThread("discord-thread-alpha");
    const betaThread = createFakeThread("discord-thread-beta");

    const alphaTurn = bridge.handleThreadMessage({
      mode: "mention",
      text: "hello alpha",
      thread: alphaThread,
    });
    const alphaSessionId = runtime.calls.startSession[0];

    const betaTurn = bridge.handleThreadMessage({
      mode: "mention",
      text: "hello beta",
      thread: betaThread,
    });
    const betaSessionId = runtime.calls.startSession[1];

    runtime.emit(alphaSessionId, {
      payload: { text: "alpha" },
      type: "message.delta",
    });
    runtime.emit(alphaSessionId, {
      type: "message.completed",
    });
    runtime.emit(betaSessionId, {
      payload: { text: "beta" },
      type: "message.delta",
    });
    runtime.emit(betaSessionId, {
      type: "message.completed",
    });

    await Promise.all([alphaTurn, betaTurn]);

    expect(alphaSessionId).not.toBe(betaSessionId);
    expect(bridge.getSessionId(alphaThread.id)).toBe(alphaSessionId);
    expect(bridge.getSessionId(betaThread.id)).toBe(betaSessionId);
    expect(alphaThread.posts).toEqual(["alpha"]);
    expect(betaThread.posts).toEqual(["beta"]);
  });

  test("coalesces busy-thread messages into the next Discord turn", async () => {
    const runtime = createRuntimeSessionApiStub();
    const bridge = createDiscordRuntimeBridge({
      sessionApi: runtime.sessionApi,
    });
    const thread = createFakeThread("discord-thread-queue");

    const firstTurn = bridge.handleThreadMessage({
      mode: "mention",
      text: "first message",
      thread,
    });
    const sessionId = runtime.calls.startSession[0];

    const secondTurn = bridge.handleThreadMessage({
      mode: "subscribed",
      text: "second message",
      thread,
    });
    const thirdTurn = bridge.handleThreadMessage({
      mode: "subscribed",
      text: "third message",
      thread,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(runtime.calls.startSession).toEqual([sessionId]);

    runtime.emit(sessionId, {
      payload: { text: "first reply" },
      type: "message.delta",
    });
    runtime.emit(sessionId, {
      type: "message.completed",
    });

    await firstTurn;
    await Promise.resolve();
    await Promise.resolve();

    expect(runtime.calls.sendInput).toEqual([
      {
        input: { text: "first message", type: "text" },
        sessionId,
      },
      {
        input: { text: "second message\n\nthird message", type: "text" },
        sessionId,
      },
    ]);

    runtime.emit(sessionId, {
      payload: { text: "second reply" },
      type: "message.delta",
    });
    runtime.emit(sessionId, {
      type: "message.completed",
    });

    await secondTurn;
    await thirdTurn;

    expect(thread.posts).toEqual(["first reply", "second reply"]);
  });

  test("streams runtime text back to Discord and clears failed thread mappings", async () => {
    const runtime = createRuntimeSessionApiStub();
    const bridge = createDiscordRuntimeBridge({
      sessionApi: runtime.sessionApi,
    });
    const thread = createFakeThread("discord-thread-failure");

    const turn = bridge.handleThreadMessage({
      mode: "mention",
      text: "trigger failure",
      thread,
    });
    const sessionId = runtime.calls.startSession[0];

    runtime.emit(sessionId, {
      payload: { text: "partial" },
      type: "message.delta",
    });
    runtime.emit(sessionId, {
      payload: { error: "runtime exploded" },
      type: "session.failed",
    });

    await turn;

    expect(thread.posts).toEqual([
      "partial",
      "AgentSuit runtime session failed: runtime exploded",
    ]);
    expect(bridge.getSessionId(thread.id)).toBeUndefined();
  });

  test("routes explicit stop requests to runtime interrupt and stops streaming the active turn", async () => {
    const runtime = createRuntimeSessionApiStub();
    const bridge = createDiscordRuntimeBridge({
      sessionApi: runtime.sessionApi,
    });
    const thread = createFakeThread("discord-thread-stop");

    const turn = bridge.handleThreadMessage({
      mode: "mention",
      text: "long running work",
      thread,
    });
    const sessionId = runtime.calls.startSession[0];

    runtime.emit(sessionId, {
      payload: { text: "hello" },
      type: "message.delta",
    });

    await thread.waitForChunkCount(1);
    await bridge.stopThread(thread.id);

    runtime.emit(sessionId, {
      payload: { text: " should-not-arrive" },
      type: "message.delta",
    });
    runtime.emit(sessionId, {
      type: "message.completed",
    });

    await turn;
    await thread.waitForStreamToFinish();

    expect(runtime.calls.interrupt).toEqual([sessionId]);
    expect(thread.chunkLog).toEqual(["hello"]);
    expect(thread.posts).toEqual(["hello"]);
    expect(bridge.getSessionId(thread.id)).toBe(sessionId);
  });

  test("creates a Discord IM exposure plugin that participates in runtime startup and shutdown", async () => {
    const lifecycle = [];
    const plugin = createDiscordImPlugin({
      createBotRuntime({ config, runtimeBridge }) {
        lifecycle.push(["create", config.adapter, typeof runtimeBridge]);

        return {
          async start(context) {
            lifecycle.push(["start", context.runtime.report.healthUrl]);
          },
          async stop() {
            lifecycle.push(["stop"]);
          },
        };
      },
      env: {
        DISCORD_APPLICATION_ID: "discord-application-id",
        DISCORD_BOT_TOKEN: "discord-token",
        DISCORD_PUBLIC_KEY: "discord-public-key",
      },
    });

    await plugin.setup(createPluginContextContract());
    await plugin.start({
      runtime: {
        report: {
          adapterName: "mock",
          healthUrl: "http://127.0.0.1:3000/healthz",
          host: "127.0.0.1",
          instanceId: "runtime-1",
          port: 3000,
          startedAt: new Date().toISOString(),
          suitName: "minimal-starter",
        },
      },
    });
    await plugin.stop();

    expect(plugin.name).toBe("discord");
    expect(lifecycle).toEqual([
      ["create", "discord", "object"],
      ["start", "http://127.0.0.1:3000/healthz"],
      ["stop"],
    ]);
  });

  test("exports a discoverable Discord plugin definition for the exposure host", () => {
    expect(exposurePluginDefinitions).toEqual([discordImPluginDefinition]);
    expect(discordImPluginDefinition.manifest).toMatchObject({
      adapter: "discord",
      expose: "im",
      name: "@agentsuit/plugin-im-chat",
    });
    expect(discordImPluginDefinition.manifest.requires).toEqual({
      host: "^0.1.0",
      pluginApi: "^0.1.0",
    });
    expect(
      discordImPluginDefinition.manifest.config?.env?.map(
        (field) => field.name,
      ),
    ).toEqual(
      expect.arrayContaining([
        "DISCORD_APPLICATION_ID",
        "DISCORD_BOT_TOKEN",
        "DISCORD_PUBLIC_KEY",
      ]),
    );
  });
});
