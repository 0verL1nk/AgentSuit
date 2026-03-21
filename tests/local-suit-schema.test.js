import { describe, expect, test } from "bun:test";

import {
  SUPPORTED_RUNTIMES,
  createValidationReport,
  validateSuitManifest,
} from "../packages/schema/src/index.ts";

describe("minimal Suit schema", () => {
  test("accepts the minimal manifest used by the local workflow", () => {
    const report = validateSuitManifest({
      apiVersion: "suit.agent/v1",
      kind: "Suit",
      metadata: {
        name: "demo-suit",
        version: "0.1.0",
        title: "Demo Suit",
        description: "Minimal suit fixture",
      },
      base: {
        compatibility: {
          runtimes: ["openclaw", "claude-code", "codex"],
        },
        target: {
          domain: "software-engineering",
          mode: "coding-agent",
        },
      },
      prompt: {
        overlays: [{ file: "assets/prompts/system.md" }],
      },
    });

    expect(SUPPORTED_RUNTIMES).toEqual(["openclaw", "claude-code", "codex"]);
    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  test("reports schema errors for unsupported runtime values", () => {
    const report = validateSuitManifest({
      apiVersion: "suit.agent/v1",
      kind: "Suit",
      metadata: {
        name: "demo-suit",
        version: "0.1.0",
      },
      base: {
        compatibility: {
          runtimes: ["openclaw", "cursor"],
        },
      },
      prompt: {
        overlays: [{ file: "assets/prompts/system.md" }],
      },
    });

    expect(report.valid).toBe(false);
    expect(report.errors).toContainEqual(
      expect.objectContaining({
        code: "UNSUPPORTED_RUNTIME",
        path: "base.compatibility.runtimes[1]",
        severity: "error",
      }),
    );
  });

  test("creates deterministic validation report shapes", () => {
    const report = createValidationReport();

    expect(report).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    });
  });
});
