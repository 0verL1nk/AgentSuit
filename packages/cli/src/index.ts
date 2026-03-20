#!/usr/bin/env bun

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

function renderHelp(): string {
  const commandLines = COMMANDS.map((command) => `  ${command}`).join("\n");

  return `Usage: suit <command> [options]

Bootstrap CLI for the Agent Suit workspace.

Commands:
${commandLines}

Run "suit <command>" to use a command. Scaffolded commands currently return a not implemented error.`;
}

function isCommandName(value: string): value is CommandName {
  return COMMANDS.includes(value as CommandName);
}

function main(argv: string[]): number {
  const [firstArg] = argv;

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

  console.error(`Command "${firstArg}" is not implemented yet.`);
  return 1;
}

process.exit(main(process.argv.slice(2)));
