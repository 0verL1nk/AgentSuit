#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  buildInspectSummary,
  buildValidationSummary,
  createSuitScaffold,
  loadSuit,
  packSuit,
} from "@agentsuit/core";

const COMMANDS = [
  "init",
  "new",
  "extract",
  "validate",
  "inspect",
  "redact",
  "pack",
  "unpack",
  "publish",
  "pull",
  "add",
  "apply",
] as const;

type CommandName = (typeof COMMANDS)[number];
type CommandHandler = (args: string[]) => number;

const IMPLEMENTED_COMMANDS: Partial<Record<CommandName, CommandHandler>> = {
  new: handleNewCommand,
  inspect: handleInspectCommand,
  pack: handlePackCommand,
  validate: handleValidateCommand,
};

function renderHelp(): string {
  const commandLines = COMMANDS.map((command) => `  ${command}`).join("\n");

  return `Usage: suit <command> [options]

Bootstrap CLI for the Agent Suit workspace.

Commands:
${commandLines}

Run "suit <command>" to use a command. Unimplemented commands return a not implemented error.`;
}

function isCommandName(value: string): value is CommandName {
  return COMMANDS.includes(value as CommandName);
}

function main(argv: string[]): number {
  const [firstArg, ...restArgs] = argv;

  if (
    !firstArg ||
    firstArg === "--help" ||
    firstArg === "-h" ||
    firstArg === "help"
  ) {
    console.log(renderHelp());
    return 0;
  }

  if (!isCommandName(firstArg)) {
    console.error(`Unknown command "${firstArg}".`);
    console.error("");
    console.error(renderHelp());
    return 1;
  }

  const handler = IMPLEMENTED_COMMANDS[firstArg];

  if (handler) {
    return handler(restArgs);
  }

  console.error(`Command "${firstArg}" is not implemented yet.`);
  return 1;
}

function handleNewCommand(args: string[]): number {
  const [name] = args;

  if (!name) {
    console.error('Command "new" requires a suit name.');
    return 1;
  }

  const targetDirectory = resolve(process.cwd(), name);

  if (existsSync(targetDirectory)) {
    console.error(`Target directory already exists: ${targetDirectory}`);
    return 1;
  }

  createSuitScaffold(targetDirectory, name);
  console.log(`Created suit scaffold at ${join(targetDirectory)}.`);
  return 0;
}

function handleValidateCommand(args: string[]): number {
  const [targetPath] = args;

  if (!targetPath) {
    console.error('Command "validate" requires a suit path.');
    return 1;
  }

  const loadedSuit = loadSuit(resolve(process.cwd(), targetPath));
  const summary = buildValidationSummary(loadedSuit);

  if (!summary.valid) {
    console.error(`Validation failed for ${summary.suitName}.`);
    for (const finding of summary.errors) {
      console.error(
        `- [${finding.code}] ${finding.path ?? "manifest"}: ${finding.message}`,
      );
    }
    return 1;
  }

  console.log(`Validation passed for ${summary.suitName}.`);
  if (summary.referencedFiles.length > 0) {
    console.log(`Referenced files: ${summary.referencedFiles.join(", ")}`);
  }

  return 0;
}

function handleInspectCommand(args: string[]): number {
  const [targetPath] = args;

  if (!targetPath) {
    console.error('Command "inspect" requires a suit path.');
    return 1;
  }

  const loadedSuit = loadSuit(resolve(process.cwd(), targetPath));
  const summary = buildInspectSummary(loadedSuit);

  console.log(`Title: ${summary.title}`);
  console.log(`Version: ${summary.version}`);
  console.log(`Runtimes: ${summary.runtimes.join(", ")}`);
  console.log(
    `Prompt overlays: ${summary.overlays.length > 0 ? summary.overlays.join(", ") : "none"}`,
  );

  if (summary.findings.length > 0) {
    console.log("Findings:");
    for (const finding of summary.findings) {
      console.log(
        `- [${finding.code}] ${finding.path ?? "manifest"}: ${finding.message}`,
      );
    }
  }

  return 0;
}

function handlePackCommand(args: string[]): number {
  const [targetPath] = args;

  if (!targetPath) {
    console.error('Command "pack" requires a suit path.');
    return 1;
  }

  try {
    const result = packSuit(resolve(process.cwd(), targetPath));
    console.log(`Packed suit to ${result.archivePath}.`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

process.exit(main(process.argv.slice(2)));
