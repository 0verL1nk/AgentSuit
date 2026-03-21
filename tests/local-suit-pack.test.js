import { describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSuitScaffold, packSuit } from "../packages/core/src/index.ts";

function withTempDir(run) {
  const directory = mkdtempSync(join(tmpdir(), "agentsuit-pack-"));

  try {
    return run(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

describe("local suit packaging", () => {
  test("packages a valid suit into a normalized package root", () => {
    withTempDir((directory) => {
      const suitRoot = join(directory, "demo-suit");
      createSuitScaffold(suitRoot, "demo-suit");

      const result = packSuit(suitRoot);
      const archiveList = Bun.spawnSync({
        cmd: ["tar", "-tzf", result.archivePath],
        cwd: directory,
        stderr: "pipe",
        stdout: "pipe",
      });

      expect(result.archivePath.endsWith("demo-suit-0.1.0.suit.tgz")).toBe(
        true,
      );
      expect(archiveList.exitCode).toBe(0);
      expect(archiveList.stdout.toString()).toContain("package/suit.yaml");
      expect(archiveList.stdout.toString()).toContain(
        "package/assets/prompts/system.md",
      );
    });
  });

  test("refuses to package an invalid suit", () => {
    withTempDir((directory) => {
      const suitRoot = join(directory, "broken-suit");
      mkdirSync(join(suitRoot, "assets/prompts"), { recursive: true });
      writeFileSync(
        join(suitRoot, "suit.yaml"),
        `apiVersion: suit.agent/v1
kind: Suit

metadata:
  name: broken-suit
  version: 0.1.0

prompt:
  overlays:
    - file: assets/prompts/missing.md
`,
      );

      expect(() => packSuit(suitRoot)).toThrow(
        "Cannot package an invalid suit.",
      );
    });
  });
});
