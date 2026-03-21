export const packageName = "@agentsuit/schema";

export const SUPPORTED_RUNTIMES = ["openclaw", "claude-code", "codex"] as const;

export type SuitRuntime = (typeof SUPPORTED_RUNTIMES)[number];

export interface SuitPromptOverlay {
  file: string;
}

export interface SuitManifest {
  apiVersion: string;
  kind: "Suit";
  metadata: {
    name: string;
    version: string;
    title?: string;
    description?: string;
  };
  base?: {
    compatibility?: {
      runtimes?: SuitRuntime[];
    };
    target?: {
      domain?: string;
      mode?: string;
    };
  };
  prompt?: {
    overlays?: SuitPromptOverlay[];
  };
  [key: string]: unknown;
}

export type ValidationFindingCode =
  | "SCHEMA_ERROR"
  | "FILE_MISSING"
  | "UNSUPPORTED_RUNTIME";

export interface ValidationFinding {
  code: ValidationFindingCode;
  message: string;
  path?: string;
  severity: "error" | "warning";
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
}

export function describePackage(): string {
  return `${packageName} minimal manifest schema`;
}

export function createValidationReport(): ValidationReport {
  return {
    valid: true,
    errors: [],
    warnings: [],
  };
}

export function validateSuitManifest(value: unknown): ValidationReport {
  const report = createValidationReport();

  if (!isRecord(value)) {
    pushError(report, "SCHEMA_ERROR", "Manifest must be an object.");
    return finalize(report);
  }

  if (value.apiVersion !== "suit.agent/v1") {
    pushError(
      report,
      "SCHEMA_ERROR",
      'Manifest apiVersion must be "suit.agent/v1".',
      "apiVersion",
    );
  }

  if (value.kind !== "Suit") {
    pushError(report, "SCHEMA_ERROR", 'Manifest kind must be "Suit".', "kind");
  }

  validateMetadata(value.metadata, report);
  validateBase(value.base, report);
  validatePrompt(value.prompt, report);

  return finalize(report);
}

function validateMetadata(
  value: unknown,
  report: ValidationReport,
): asserts value is SuitManifest["metadata"] | undefined {
  if (!isRecord(value)) {
    pushError(report, "SCHEMA_ERROR", "metadata is required.", "metadata");
    return;
  }

  assertString(value.name, report, "metadata.name");
  assertString(value.version, report, "metadata.version");
  assertOptionalString(value.title, report, "metadata.title");
  assertOptionalString(value.description, report, "metadata.description");
}

function validateBase(value: unknown, report: ValidationReport): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    pushError(report, "SCHEMA_ERROR", "base must be an object.", "base");
    return;
  }

  if (value.compatibility !== undefined) {
    if (!isRecord(value.compatibility)) {
      pushError(
        report,
        "SCHEMA_ERROR",
        "base.compatibility must be an object.",
        "base.compatibility",
      );
    } else if (value.compatibility.runtimes !== undefined) {
      if (!Array.isArray(value.compatibility.runtimes)) {
        pushError(
          report,
          "SCHEMA_ERROR",
          "base.compatibility.runtimes must be an array.",
          "base.compatibility.runtimes",
        );
      } else {
        value.compatibility.runtimes.forEach((runtime, index) => {
          if (!SUPPORTED_RUNTIMES.includes(runtime as SuitRuntime)) {
            pushError(
              report,
              "UNSUPPORTED_RUNTIME",
              `Unsupported runtime "${String(runtime)}".`,
              `base.compatibility.runtimes[${index}]`,
            );
          }
        });
      }
    }
  }

  if (value.target !== undefined && !isRecord(value.target)) {
    pushError(
      report,
      "SCHEMA_ERROR",
      "base.target must be an object.",
      "base.target",
    );
  }
}

function validatePrompt(value: unknown, report: ValidationReport): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    pushError(report, "SCHEMA_ERROR", "prompt must be an object.", "prompt");
    return;
  }

  if (value.overlays === undefined) {
    return;
  }

  if (!Array.isArray(value.overlays)) {
    pushError(
      report,
      "SCHEMA_ERROR",
      "prompt.overlays must be an array.",
      "prompt.overlays",
    );
    return;
  }

  value.overlays.forEach((overlay, index) => {
    if (!isRecord(overlay)) {
      pushError(
        report,
        "SCHEMA_ERROR",
        "Each prompt overlay must be an object.",
        `prompt.overlays[${index}]`,
      );
      return;
    }

    assertString(overlay.file, report, `prompt.overlays[${index}].file`);
  });
}

function assertString(
  value: unknown,
  report: ValidationReport,
  path: string,
): void {
  if (typeof value !== "string" || value.length === 0) {
    pushError(
      report,
      "SCHEMA_ERROR",
      `${path} must be a non-empty string.`,
      path,
    );
  }
}

function assertOptionalString(
  value: unknown,
  report: ValidationReport,
  path: string,
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string") {
    pushError(report, "SCHEMA_ERROR", `${path} must be a string.`, path);
  }
}

function pushError(
  report: ValidationReport,
  code: ValidationFindingCode,
  message: string,
  path?: string,
): void {
  const finding: ValidationFinding = {
    code,
    message,
    severity: "error",
  };

  if (path !== undefined) {
    finding.path = path;
  }

  report.errors.push(finding);
}

function finalize(report: ValidationReport): ValidationReport {
  report.valid = report.errors.length === 0;
  return report;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
