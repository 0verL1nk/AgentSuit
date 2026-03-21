import { describe, expect, test } from "bun:test";

import { createRuntimePluginRegistry } from "../packages/core/src/index.ts";

describe("runtime plugin registry", () => {
  test("registers and retrieves runtime plugins by key", () => {
    const registry = createRuntimePluginRegistry();
    const plugin = {
      kind: "runtime",
      name: "claude-code",
      version: "0.1.0",
    };

    registry.register(plugin);

    expect(registry.list()).toEqual([plugin]);
    expect(registry.get("claude-code")).toEqual(plugin);
  });

  test("rejects duplicate plugin registrations for the same runtime", () => {
    const registry = createRuntimePluginRegistry();

    registry.register({
      kind: "runtime",
      name: "codex",
      version: "0.1.0",
    });

    expect(() =>
      registry.register({
        kind: "runtime",
        name: "codex",
        version: "0.2.0",
      }),
    ).toThrow('Runtime plugin "codex" is already registered.');
  });
});
