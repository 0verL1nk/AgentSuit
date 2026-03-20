import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const repoRoot = process.cwd();
const suitBinary = join(repoRoot, "node_modules", ".bin", "suit");

function runSuit(args) {
  return Bun.spawnSync({
    cmd: [suitBinary, ...args],
    cwd: repoRoot,
    env: process.env,
    stderr: "pipe",
    stdout: "pipe",
  });
}

describe("suit CLI bootstrap", () => {
  test("prints help output with the v0.1 commands", () => {
    const result = runSuit(["--help"]);
    const stdout = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("Usage: suit");
    expect(stdout).toContain("init");
    expect(stdout).toContain("apply");
  });

  test("returns a not implemented error for scaffolded commands", () => {
    const result = runSuit(["init"]);
    const stderr = result.stderr.toString();

    expect(result.exitCode).toBe(1);
    expect(stderr).toContain('Command "init" is not implemented yet.');
  });
});
