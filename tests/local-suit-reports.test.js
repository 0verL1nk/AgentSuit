import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  buildInspectSummary,
  buildValidationSummary,
  loadSuit,
} from "../packages/core/src/index.ts";

const repoRoot = process.cwd();

describe("local suit report builders", () => {
  test("builds a deterministic validation summary from a loaded suit", () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));

    expect(buildValidationSummary(suit)).toEqual({
      errors: [],
      referencedFiles: ["assets/prompts/system.md"],
      suitName: "minimal-starter",
      valid: true,
      warnings: [],
    });
  });

  test("builds an inspect summary with metadata and compatibility details", () => {
    const suit = loadSuit(join(repoRoot, "examples/suits/minimal-starter"));

    expect(buildInspectSummary(suit)).toEqual({
      findings: [],
      overlays: ["assets/prompts/system.md"],
      runtimes: ["openclaw", "claude-code", "codex"],
      title: "Minimal Starter Suit",
      version: "0.1.0",
    });
  });
});
