#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClaudeCodeAdapterDefinition } from "@agentsuit/adapter-claude-code";
import {
  buildInspectSummary,
  buildValidationSummary,
  createSuitScaffold,
  loadSuit,
  packSuit,
} from "@agentsuit/core";
import { createExposurePluginHost } from "@agentsuit/plugin-api";
import {
  SUPPORTED_RUNTIME_EVENT_TYPES,
  createRuntimeAdapterRegistry,
  createRuntimeHost,
} from "@agentsuit/runtime";

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
  "serve",
] as const;
const EXPOSURE_PLUGIN_MODULES_ENV = "AGENTSUIT_EXPOSURE_PLUGIN_MODULES";

type CommandName = (typeof COMMANDS)[number];
type CommandHandler = (args: string[]) => number | Promise<number>;

const IMPLEMENTED_COMMANDS: Partial<Record<CommandName, CommandHandler>> = {
  new: handleNewCommand,
  inspect: handleInspectCommand,
  pack: handlePackCommand,
  serve: handleServeCommand,
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

async function main(argv: string[]): Promise<number> {
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
    return await handler(restArgs);
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

async function handleServeCommand(args: string[]): Promise<number> {
  const targetPath = args[0];

  if (!targetPath) {
    console.error('Command "serve" requires a suit path.');
    return 1;
  }

  let host = "127.0.0.1";
  let port = 0;
  let baseAgent = process.env.AGENTSUIT_BASE_AGENT ?? "mock";
  let exposeMode: "im" | undefined;
  let imAdapter: string | undefined;

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--host") {
      const value = args[index + 1];
      if (!value) {
        console.error('Command "serve" requires a value after "--host".');
        return 1;
      }

      host = value;
      index += 1;
      continue;
    }

    if (argument === "--port") {
      const value = args[index + 1];
      if (!value) {
        console.error('Command "serve" requires a value after "--port".');
        return 1;
      }

      const parsedPort = Number.parseInt(value, 10);
      if (Number.isNaN(parsedPort)) {
        console.error(`Invalid port value "${value}".`);
        return 1;
      }

      port = parsedPort;
      index += 1;
      continue;
    }

    if (argument === "--base-agent") {
      const value = args[index + 1];
      if (!value) {
        console.error('Command "serve" requires a value after "--base-agent".');
        return 1;
      }

      baseAgent = value;
      index += 1;
      continue;
    }

    if (argument === "--expose") {
      const value = args[index + 1];
      if (!value) {
        console.error('Command "serve" requires a value after "--expose".');
        return 1;
      }

      if (value !== "im") {
        console.error(
          `Unsupported exposure "${value}". Only "im" is currently supported.`,
        );
        return 1;
      }

      exposeMode = value;
      index += 1;
      continue;
    }

    if (argument === "--im-adapter") {
      const value = args[index + 1];
      if (!value) {
        console.error('Command "serve" requires a value after "--im-adapter".');
        return 1;
      }

      imAdapter = value;
      index += 1;
      continue;
    }

    console.error(`Unknown option "${argument}" for command "serve".`);
    return 1;
  }

  if (imAdapter && exposeMode !== "im") {
    console.error(
      'Command "serve" requires "--expose im" when "--im-adapter" is provided.',
    );
    return 1;
  }

  if (exposeMode === "im" && !imAdapter) {
    console.error(
      'Command "serve" requires "--im-adapter" when "--expose im" is selected.',
    );
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

  const adapterRegistry = createRuntimeAdapterRegistry();
  adapterRegistry.register(createClaudeCodeAdapterDefinition());

  const runtimeHost = createRuntimeHost({
    adapterName: baseAgent,
    adapterRegistry,
    host,
    port,
    suit: loadedSuit,
  });
  const exposurePluginHost = createExposurePluginHost({
    env: process.env,
    sources: createExposurePluginSources(process.env, process.cwd()),
  });

  try {
    const report = await runtimeHost.start();
    const startedPlugins = [];

    if (exposeMode && imAdapter) {
      try {
        startedPlugins.push(
          ...(await exposurePluginHost.startPlugins(
            [
              {
                adapter: imAdapter,
                expose: exposeMode,
              },
            ],
            {
              pluginContext: {
                runtime: {
                  eventTypes: [...SUPPORTED_RUNTIME_EVENT_TYPES],
                  sessionApi: runtimeHost.sessionApi,
                },
              },
              startContext: {
                runtime: {
                  report,
                },
              },
            },
          )),
        );
      } catch (error) {
        await exposurePluginHost.stopAll();
        await runtimeHost.stop();
        throw error;
      }
    }
    const activeExposurePlugin = startedPlugins[0];

    console.log(`Runtime started for ${report.suitName}.`);
    console.log(`Base agent: ${report.adapterName}`);
    console.log(`Health: ${report.healthUrl}`);
    if (activeExposurePlugin && exposeMode) {
      console.log(`Exposure: ${exposeMode}/${activeExposurePlugin.name}`);
    }

    return await new Promise<number>((resolve) => {
      let shuttingDown = false;

      const shutdown = async () => {
        if (shuttingDown) {
          return;
        }

        shuttingDown = true;
        process.off("SIGINT", onSignal);
        process.off("SIGTERM", onSignal);

        await exposurePluginHost.stopAll();
        await runtimeHost.stop();
        resolve(0);
      };

      const onSignal = () => {
        shutdown().catch((error) => {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(message);
          resolve(1);
        });
      };

      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

function createExposurePluginSources(
  env: NodeJS.ProcessEnv,
  cwd: string,
): Array<{
  id: string;
  load(): Promise<unknown>;
}> {
  const configuredModules = readConfiguredExposurePluginModules(env, cwd);

  return configuredModules.map((moduleId) => ({
    id: moduleId,
    async load() {
      return await import(resolveExposurePluginModuleSpecifier(moduleId, cwd));
    },
  }));
}

function readConfiguredExposurePluginModules(
  env: NodeJS.ProcessEnv,
  cwd: string,
): string[] {
  const explicitModules = env[EXPOSURE_PLUGIN_MODULES_ENV]
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (explicitModules && explicitModules.length > 0) {
    return explicitModules;
  }

  const packagesDir = resolve(cwd, "packages");

  if (!existsSync(packagesDir)) {
    return [];
  }

  return readdirSync(packagesDir)
    .map((entry) => join(packagesDir, entry, "package.json"))
    .filter((manifestPath) => existsSync(manifestPath))
    .map((manifestPath) => {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        name?: string;
      };

      return manifest.name;
    })
    .filter(
      (name): name is string =>
        !!name &&
        name.startsWith("@agentsuit/plugin-") &&
        name !== "@agentsuit/plugin-api",
    )
    .sort();
}

function resolveExposurePluginModuleSpecifier(
  moduleId: string,
  cwd: string,
): string {
  if (moduleId.startsWith(".") || moduleId.startsWith("/")) {
    return pathToFileURL(resolve(cwd, moduleId)).href;
  }

  return moduleId;
}

main(process.argv.slice(2))
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
