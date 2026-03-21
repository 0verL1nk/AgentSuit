import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = process.cwd();
const suitBinary = join(repoRoot, "node_modules", ".bin", "suit");

function runSuit(args, cwd = repoRoot) {
  return Bun.spawnSync({
    cmd: [suitBinary, ...args],
    cwd,
    env: process.env,
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
