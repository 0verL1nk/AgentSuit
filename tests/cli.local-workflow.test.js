import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = process.cwd();
const suitBinary = join(repoRoot, "node_modules", ".bin", "suit");

function runSuit(args, cwd = repoRoot, env = process.env) {
  return Bun.spawnSync({
    cmd: [suitBinary, ...args],
    cwd,
    env,
    stderr: "pipe",
    stdout: "pipe",
  });
}

function spawnSuit(args, cwd = repoRoot, env = process.env) {
  return Bun.spawn({
    cmd: [suitBinary, ...args],
    cwd,
    env,
    stderr: "pipe",
    stdout: "pipe",
  });
}

function withTempDir(run) {
  const directory = mkdtempSync(join(tmpdir(), "agentsuit-cli-"));

  try {
    return run(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

describe("suit local workflow commands", () => {
  test("creates a new suit scaffold from the CLI", () => {
    withTempDir((directory) => {
      const result = runSuit(["new", "demo-suit"], directory);
      const suitRoot = join(directory, "demo-suit");

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain("Created suit scaffold");
      expect(existsSync(join(suitRoot, "suit.yaml"))).toBe(true);
      expect(
        readFileSync(join(suitRoot, "assets/prompts/system.md"), "utf8"),
      ).toContain("Prefer explicit, testable changes.");
    });
  });

  test("keeps placeholder behavior for commands that are still unimplemented", () => {
    const result = runSuit(["extract"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      'Command "extract" is not implemented yet.',
    );
  });

  test("shows serve in the help output and reports missing serve arguments clearly", () => {
    const helpResult = runSuit(["--help"]);
    const serveResult = runSuit(["serve"]);

    expect(helpResult.stdout.toString()).toContain("serve");
    expect(serveResult.exitCode).toBe(1);
    expect(serveResult.stderr.toString()).toContain(
      'Command "serve" requires a suit path.',
    );
  });

  test("fails serve predictably for an unknown selected base agent", () => {
    const result = runSuit([
      "serve",
      "examples/suits/minimal-starter",
      "--base-agent",
      "missing-agent",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      'Unknown runtime adapter "missing-agent".',
    );
  });

  test("fails serve predictably when no discovered plugin matches the requested adapter", () => {
    const result = runSuit([
      "serve",
      "examples/suits/minimal-starter",
      "--expose",
      "im",
      "--im-adapter",
      "slack",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      'No discovered exposure plugin provides "im/slack".',
    );
  });

  test("fails serve predictably when Discord IM exposure is requested without configuration", () => {
    const env = {
      ...process.env,
      DISCORD_BOT_TOKEN: "",
    };
    const result = runSuit(
      [
        "serve",
        "examples/suits/minimal-starter",
        "--expose",
        "im",
        "--im-adapter",
        "discord",
      ],
      repoRoot,
      env,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      'Missing Discord IM configuration: set "DISCORD_BOT_TOKEN".',
    );
  });

  test("starts a discovered exposure plugin without hardcoding the implementation in the CLI", async () => {
    const env = {
      ...process.env,
      AGENTSUIT_EXPOSURE_PLUGIN_MODULES:
        "./tests/fixtures/discovered-im-plugin.ts",
    };
    const childProcess = spawnSuit(
      [
        "serve",
        "examples/suits/minimal-starter",
        "--expose",
        "im",
        "--im-adapter",
        "discovered-discord",
      ],
      repoRoot,
      env,
    );
    const reader = childProcess.stdout.getReader();
    let output = "";

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        output += new TextDecoder().decode(value);
        if (output.includes("Exposure: im/discovered-im-plugin")) {
          break;
        }
      }

      expect(output).toContain("Runtime started for minimal-starter.");
      expect(output).toContain("Exposure: im/discovered-im-plugin");
    } finally {
      childProcess.kill();
      await childProcess.exited;
    }
  });

  test("fails serve predictably when no discovered plugin matches the requested exposure", () => {
    const env = {
      ...process.env,
      AGENTSUIT_EXPOSURE_PLUGIN_MODULES:
        "./tests/fixtures/discovered-im-plugin.ts",
    };
    const result = runSuit(
      [
        "serve",
        "examples/suits/minimal-starter",
        "--expose",
        "im",
        "--im-adapter",
        "slack",
      ],
      repoRoot,
      env,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      'No discovered exposure plugin provides "im/slack".',
    );
  });

  test("fails serve predictably when a discovered module does not export plugin definitions", () => {
    const env = {
      ...process.env,
      AGENTSUIT_EXPOSURE_PLUGIN_MODULES:
        "./tests/fixtures/invalid-exposure-plugin.ts",
    };
    const result = runSuit(
      [
        "serve",
        "examples/suits/minimal-starter",
        "--expose",
        "im",
        "--im-adapter",
        "discord",
      ],
      repoRoot,
      env,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      'Exposure plugin module "./tests/fixtures/invalid-exposure-plugin.ts" does not export "exposurePluginDefinitions".',
    );
  });

  test("fails serve predictably when claude-code is selected but unavailable", () => {
    const env = {
      ...process.env,
      AGENTSUIT_BASE_AGENT: "claude-code",
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_AUTH_TOKEN: "",
      CLAUDE_CODE_USE_BEDROCK: "",
      CLAUDE_CODE_USE_VERTEX: "",
    };
    const result = runSuit(
      ["serve", "examples/suits/minimal-starter"],
      repoRoot,
      env,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      'Runtime adapter "claude-code" is not available',
    );
    expect(result.stderr.toString()).toContain(
      "Claude Code credentials are not configured",
    );
  });

  test("starts serve successfully for a valid suit and exposes health information", async () => {
    const childProcess = spawnSuit(["serve", "examples/suits/minimal-starter"]);
    const reader = childProcess.stdout.getReader();
    let output = "";

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        output += new TextDecoder().decode(value);
        if (output.includes("Health: http://")) {
          break;
        }
      }

      expect(output).toContain("Runtime started for minimal-starter.");
      const healthLine = output
        .split("\n")
        .find((line) => line.startsWith("Health: "));

      expect(healthLine).toBeDefined();
      const healthUrl = healthLine.replace("Health: ", "").trim();
      const response = await fetch(healthUrl);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        status: "alive",
        suitName: "minimal-starter",
      });
    } finally {
      childProcess.kill();
      await childProcess.exited;
    }
  });

  test("prefers the CLI base-agent flag over AGENTSUIT_BASE_AGENT", async () => {
    const env = {
      ...process.env,
      AGENTSUIT_BASE_AGENT: "claude-code",
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_AUTH_TOKEN: "",
      CLAUDE_CODE_USE_BEDROCK: "",
      CLAUDE_CODE_USE_VERTEX: "",
    };
    const childProcess = spawnSuit(
      ["serve", "examples/suits/minimal-starter", "--base-agent", "mock"],
      repoRoot,
      env,
    );
    const reader = childProcess.stdout.getReader();
    let output = "";

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        output += new TextDecoder().decode(value);
        if (output.includes("Health: http://")) {
          break;
        }
      }

      expect(output).toContain("Runtime started for minimal-starter.");
      expect(output).toContain("Base agent: mock");
    } finally {
      childProcess.kill();
      await childProcess.exited;
    }
  });

  test("accepts AGENTSUIT_BASE_AGENT as the base-agent selector", () => {
    const env = {
      ...process.env,
      AGENTSUIT_BASE_AGENT: "missing-agent",
    };
    const result = runSuit(
      ["serve", "examples/suits/minimal-starter"],
      repoRoot,
      env,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      'Unknown runtime adapter "missing-agent".',
    );
  });

  test("fails serve validation for an invalid suit", () => {
    const result = runSuit(["serve", "examples/suits/missing-overlay"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      "Validation failed for missing-overlay",
    );
    expect(result.stderr.toString()).toContain("[FILE_MISSING]");
  });

  test("fails serve startup predictably when the requested port is already in use", async () => {
    const occupied = createServer();

    await new Promise((resolve) => {
      occupied.listen(0, "127.0.0.1", resolve);
    });

    const address = occupied.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to determine occupied test port.");
    }

    try {
      const result = runSuit([
        "serve",
        "examples/suits/minimal-starter",
        "--port",
        String(address.port),
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.toString()).toContain(
        `Failed to start server. Is port ${address.port} in use?`,
      );
    } finally {
      await new Promise((resolve, reject) => {
        occupied.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(undefined);
        });
      });
    }
  });

  test("validates a well-formed local suit", () => {
    const result = runSuit(["validate", "examples/suits/minimal-starter"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(
      "Validation passed for minimal-starter",
    );
    expect(result.stdout.toString()).toContain("assets/prompts/system.md");
  });

  test("fails validation for the invalid missing-overlay fixture", () => {
    const result = runSuit(["validate", "examples/suits/missing-overlay"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(
      "Validation failed for missing-overlay",
    );
    expect(result.stderr.toString()).toContain("[FILE_MISSING]");
  });

  test("prints a readable inspect summary", () => {
    const result = runSuit(["inspect", "examples/suits/minimal-starter"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("Title: Minimal Starter Suit");
    expect(result.stdout.toString()).toContain("Version: 0.1.0");
    expect(result.stdout.toString()).toContain(
      "Runtimes: openclaw, claude-code, codex",
    );
  });

  test("packages a valid suit from the CLI", () => {
    withTempDir((directory) => {
      const createResult = runSuit(["new", "demo-suit"], directory);
      const packResult = runSuit(["pack", "demo-suit"], directory);

      expect(createResult.exitCode).toBe(0);
      expect(packResult.exitCode).toBe(0);
      expect(packResult.stdout.toString()).toContain("Packed suit to");
      expect(existsSync(join(directory, "demo-suit-0.1.0.suit.tgz"))).toBe(
        true,
      );
    });
  });
});
