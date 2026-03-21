import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSuitScaffold, loadSuit } from "../packages/core/src/index.ts";

function withTempDir(run) {
  const directory = mkdtempSync(join(tmpdir(), "agentsuit-scaffold-"));

  try {
    return run(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

describe("local suit scaffolding", () => {
  test("creates a minimal suit directory that validates immediately", () => {
    withTempDir((directory) => {
      const suitRoot = join(directory, "demo-suit");
      createSuitScaffold(suitRoot, "demo-suit");
      const readme = readFileSync(join(suitRoot, "README.md"), "utf8");
      const suit = loadSuit(suitRoot);

      expect(existsSync(join(suitRoot, "assets/prompts/system.md"))).toBe(true);
      expect(readme).toContain("# demo-suit");
      expect(suit.manifest.metadata.name).toBe("demo-suit");
      expect(suit.report.valid).toBe(true);
    });
  });
});
