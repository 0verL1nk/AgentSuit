import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadSuit } from "../packages/core/src/index.ts";

const repoRoot = process.cwd();

function withTempDir(run) {
  const directory = mkdtempSync(join(tmpdir(), "agentsuit-core-"));

  try {
    return run(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

describe("local suit core helpers", () => {
  test("loads the repository fixture and validates referenced assets", () => {
    const result = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));

    expect(result.manifest.metadata.name).toBe("minimal-starter");
    expect(result.report.valid).toBe(true);
    expect(result.report.errors).toEqual([]);
  });

  test("reports missing referenced files as deterministic findings", () => {
    const result = withTempDir((directory) => {
      mkdirSync(join(directory, "assets/prompts"), { recursive: true });
      writeFileSync(
        join(directory, "suit.yaml"),
        `apiVersion: suit.agent/v1
kind: Suit

metadata:
  name: broken-suit
  version: 0.1.0

base:
  compatibility:
    runtimes:
      - openclaw

prompt:
  overlays:
    - file: assets/prompts/missing.md
`,
      );

      return loadSuit(directory);
    });

    expect(result.report.valid).toBe(false);
    expect(result.report.errors).toContainEqual(
      expect.objectContaining({
        code: "FILE_MISSING",
        path: "assets/prompts/missing.md",
        severity: "error",
      }),
    );
  });
});
