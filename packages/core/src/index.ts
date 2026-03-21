import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  type SuitManifest,
  type ValidationReport,
  createValidationReport,
  validateSuitManifest,
} from "@agentsuit/schema";

export const packageName = "@agentsuit/core";

export interface LoadedSuit {
  manifest: SuitManifest;
  manifestPath: string;
  referencedFiles: string[];
  report: ValidationReport;
  rootDir: string;
}

export interface RuntimePlugin {
  kind: "runtime";
  name: string;
  version: string;
}

export interface RuntimePluginRegistry {
  get(name: string): RuntimePlugin | undefined;
  list(): RuntimePlugin[];
  register(plugin: RuntimePlugin): void;
}

export interface ValidationSummary {
  errors: ValidationReport["errors"];
  referencedFiles: string[];
  suitName: string;
  valid: boolean;
  warnings: ValidationReport["warnings"];
}

export interface InspectSummary {
  findings: ValidationReport["errors"];
  overlays: string[];
  runtimes: string[];
  title: string;
  version: string;
}

export interface PackResult {
  archivePath: string;
}

export function describePackage(): string {
  return `${packageName} local workflow helpers`;
}

export function loadSuit(rootDir: string): LoadedSuit {
  const manifestPath = join(rootDir, "suit.yaml");
  const source = readFileSync(manifestPath, "utf8");
  const parsedManifest = parseMinimalYaml(source);
  const report = validateSuitManifest(parsedManifest);
  const manifest = parsedManifest as SuitManifest;
  const referencedFiles = collectReferencedFiles(manifest);

  for (const filePath of referencedFiles) {
    const resolvedPath = join(rootDir, filePath);

    if (!existsSync(resolvedPath)) {
      report.errors.push({
        code: "FILE_MISSING",
        message: `Referenced file "${filePath}" does not exist.`,
        path: filePath,
        severity: "error",
      });
    }
  }

  report.valid = report.errors.length === 0;

  return {
    manifest,
    manifestPath,
    referencedFiles,
    report,
    rootDir,
  };
}

export function createCoreValidationReport(): ValidationReport {
  return createValidationReport();
}

export function createRuntimePluginRegistry(): RuntimePluginRegistry {
  const plugins = new Map<string, RuntimePlugin>();

  return {
    get(name) {
      return plugins.get(name);
    },
    list() {
      return [...plugins.values()];
    },
    register(plugin) {
      if (plugins.has(plugin.name)) {
        throw new Error(
          `Runtime plugin "${plugin.name}" is already registered.`,
        );
      }

      plugins.set(plugin.name, plugin);
    },
  };
}

export function createSuitScaffold(rootDir: string, suitName: string): void {
  mkdirSync(join(rootDir, "assets/prompts"), { recursive: true });
  mkdirSync(join(rootDir, "assets/skills"), { recursive: true });
  mkdirSync(join(rootDir, "assets/templates"), { recursive: true });
  mkdirSync(join(rootDir, "bindings"), { recursive: true });
  mkdirSync(join(rootDir, "schemas"), { recursive: true });

  writeFileSync(
    join(rootDir, "suit.yaml"),
    `apiVersion: suit.agent/v1
kind: Suit

metadata:
  name: ${suitName}
  version: 0.1.0
  title: ${toTitleCase(suitName)}
  description: Minimal local suit scaffold

base:
  compatibility:
    runtimes:
      - openclaw
      - claude-code
      - codex
  target:
    domain: software-engineering
    mode: coding-agent

prompt:
  overlays:
    - file: assets/prompts/system.md
`,
  );

  writeFileSync(
    join(rootDir, "README.md"),
    `# ${suitName}

Minimal local Suit scaffold created by AgentSuit.
`,
  );

  writeFileSync(
    join(rootDir, "assets/prompts/system.md"),
    "# System Prompt\n\nPrefer explicit, testable changes.\n",
  );
}

export function buildValidationSummary(
  loadedSuit: LoadedSuit,
): ValidationSummary {
  return {
    errors: loadedSuit.report.errors,
    referencedFiles: loadedSuit.referencedFiles,
    suitName: loadedSuit.manifest.metadata.name,
    valid: loadedSuit.report.valid,
    warnings: loadedSuit.report.warnings,
  };
}

export function buildInspectSummary(loadedSuit: LoadedSuit): InspectSummary {
  return {
    findings: loadedSuit.report.errors,
    overlays: loadedSuit.referencedFiles,
    runtimes: loadedSuit.manifest.base?.compatibility?.runtimes ?? [],
    title:
      loadedSuit.manifest.metadata.title ?? loadedSuit.manifest.metadata.name,
    version: loadedSuit.manifest.metadata.version,
  };
}

export function packSuit(rootDir: string): PackResult {
  const loadedSuit = loadSuit(rootDir);

  if (!loadedSuit.report.valid) {
    throw new Error("Cannot package an invalid suit.");
  }

  const archivePath = join(
    dirname(rootDir),
    `${loadedSuit.manifest.metadata.name}-${loadedSuit.manifest.metadata.version}.suit.tgz`,
  );
  const stageRoot = mkdtempSync(join(tmpdir(), "agentsuit-package-"));
  const packageRoot = join(stageRoot, "package");

  mkdirSync(packageRoot, { recursive: true });

  try {
    stageSuitPackage(rootDir, packageRoot);

    const result = spawnSync("tar", ["-czf", archivePath, "package"], {
      cwd: stageRoot,
      stdio: "pipe",
    });

    if (result.status !== 0) {
      throw new Error(
        result.stderr.toString() || "Failed to create suit package archive.",
      );
    }
  } finally {
    rmSync(stageRoot, { force: true, recursive: true });
  }

  return { archivePath };
}

function collectReferencedFiles(manifest: SuitManifest): string[] {
  const overlays = manifest.prompt?.overlays ?? [];

  return overlays
    .map((overlay) => overlay.file)
    .filter(
      (file): file is string => typeof file === "string" && file.length > 0,
    );
}

function stageSuitPackage(rootDir: string, packageRoot: string): void {
  copyIfPresent(join(rootDir, "suit.yaml"), join(packageRoot, "suit.yaml"));
  copyIfPresent(join(rootDir, "README.md"), join(packageRoot, "README.md"));
  copyIfPresent(join(rootDir, "assets"), join(packageRoot, "assets"));
  copyIfPresent(join(rootDir, "bindings"), join(packageRoot, "bindings"));
  copyIfPresent(join(rootDir, "schemas"), join(packageRoot, "schemas"));
}

function copyIfPresent(sourcePath: string, targetPath: string): void {
  if (!existsSync(sourcePath)) {
    return;
  }

  cpSync(sourcePath, targetPath, { recursive: true });
}

function parseMinimalYaml(source: string): unknown {
  const lines = source
    .split(/\r?\n/u)
    .map((rawLine) => rawLine.replace(/\t/g, "  "))
    .filter((rawLine) => {
      const trimmed = rawLine.trim();
      return trimmed.length > 0 && !trimmed.startsWith("#");
    });

  let index = 0;

  function parseBlock(expectedIndent: number): unknown {
    const currentLine = lines[index];

    if (currentLine === undefined) {
      return {};
    }

    const currentIndent = getIndent(currentLine);
    if (currentLine.trim().startsWith("- ")) {
      return parseSequence(expectedIndent);
    }

    if (currentIndent < expectedIndent) {
      return {};
    }

    return parseMapping(expectedIndent);
  }

  function parseMapping(expectedIndent: number): Record<string, unknown> {
    const record: Record<string, unknown> = {};

    while (index < lines.length) {
      const line = lines[index];
      if (line === undefined) {
        break;
      }

      const indent = getIndent(line);
      const trimmed = line.trim();

      if (indent < expectedIndent || trimmed.startsWith("- ")) {
        break;
      }

      if (indent > expectedIndent) {
        break;
      }

      const separatorIndex = trimmed.indexOf(":");
      if (separatorIndex === -1) {
        index += 1;
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const remainder = trimmed.slice(separatorIndex + 1).trim();
      index += 1;

      if (remainder.length > 0) {
        record[key] = parseScalar(remainder);
        continue;
      }

      const nextLine = lines[index];
      if (nextLine === undefined || getIndent(nextLine) <= indent) {
        record[key] = {};
        continue;
      }

      record[key] = parseBlock(getIndent(nextLine));
    }

    return record;
  }

  function parseSequence(expectedIndent: number): unknown[] {
    const items: unknown[] = [];

    while (index < lines.length) {
      const line = lines[index];
      if (line === undefined) {
        break;
      }

      const indent = getIndent(line);
      const trimmed = line.trim();

      if (indent < expectedIndent || !trimmed.startsWith("- ")) {
        break;
      }

      const content = trimmed.slice(2).trim();
      index += 1;

      if (content.length === 0) {
        const nextLine = lines[index];
        items.push(
          nextLine !== undefined && getIndent(nextLine) > indent
            ? parseBlock(getIndent(nextLine))
            : null,
        );
        continue;
      }

      const separatorIndex = content.indexOf(":");
      if (separatorIndex !== -1) {
        const key = content.slice(0, separatorIndex).trim();
        const remainder = content.slice(separatorIndex + 1).trim();
        const item: Record<string, unknown> = {};

        item[key] =
          remainder.length > 0
            ? parseScalar(remainder)
            : (() => {
                const nextLine = lines[index];
                if (nextLine === undefined || getIndent(nextLine) <= indent) {
                  return {};
                }

                return parseBlock(getIndent(nextLine));
              })();

        items.push(item);
        continue;
      }

      items.push(parseScalar(content));
    }

    return items;
  }

  return parseBlock(0);
}

function parseScalar(value: string): string {
  return value.replace(/^['"]|['"]$/gu, "");
}

function getIndent(line: string): number {
  return line.length - line.trimStart().length;
}

function toTitleCase(value: string): string {
  return value
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
