import type { AgentEvent, ServeReport, SessionApi } from "@agentsuit/runtime";
import {
  SUPPORTED_RUNTIME_EVENT_TYPES,
  createSessionApiContract,
} from "@agentsuit/runtime";

export const packageName = "@agentsuit/plugin-api";
export const pluginApiVersion = "0.1.0";
export const exposureHostVersion = "0.1.0";

export interface PluginContext {
  runtime: {
    eventTypes: AgentEvent["type"][];
    sessionApi: SessionApi;
  };
}

export interface PluginStartContext {
  runtime: {
    report: ServeReport;
  };
}

export interface CreateExposurePluginOptions {
  env?: Record<string, string | undefined>;
}

export interface ExposurePluginRequirementSet {
  host?: string;
  pluginApi?: string;
}

export interface ExposurePluginConfigField {
  description?: string;
  name: string;
  required?: boolean;
}

export interface ExposurePluginConfigContract {
  env?: ExposurePluginConfigField[];
  validate?: (env: Record<string, string | undefined>) => Promise<void> | void;
}

export interface ExposurePluginManifest {
  adapter: string;
  capabilities?: string[];
  config?: ExposurePluginConfigContract;
  expose: string;
  name: string;
  requires?: ExposurePluginRequirementSet;
  version: string;
}

export interface ExposurePlugin {
  name: string;
  setup(context: PluginContext): Promise<void>;
  start(context: PluginStartContext): Promise<void>;
  stop(): Promise<void>;
}

export interface ExposurePluginDefinition {
  create(
    options?: CreateExposurePluginOptions,
  ): ExposurePlugin | Promise<ExposurePlugin>;
  manifest: ExposurePluginManifest;
}

export interface ExposurePluginSource {
  id: string;
  load(): Promise<unknown>;
}

export interface ExposurePluginSelection {
  adapter: string;
  expose: string;
}

export interface ExposurePluginHostStartOptions {
  pluginContext: PluginContext;
  startContext: PluginStartContext;
}

export interface ExposurePluginHostOptions extends CreateExposurePluginOptions {
  hostVersion?: string;
  pluginApiVersion?: string;
  sources?: ExposurePluginSource[];
}

export interface ExposurePluginHost {
  discover(): Promise<ExposurePluginDefinition[]>;
  resolve(expose: string, adapter: string): Promise<ExposurePluginDefinition>;
  startPlugins(
    selections: ExposurePluginSelection[],
    options: ExposurePluginHostStartOptions,
  ): Promise<ExposurePlugin[]>;
  stopAll(): Promise<void>;
}

export interface ExposurePluginModule {
  exposurePluginDefinitions: ExposurePluginDefinition[];
}

export interface ExposurePluginRegistry {
  get(expose: string, adapter: string): ExposurePluginDefinition | undefined;
  list(): ExposurePluginDefinition[];
  register(plugin: ExposurePluginDefinition): void;
}

export function describePluginApiPackage(): string {
  return `${packageName} public plugin contracts`;
}

export function createPluginContextContract(): PluginContext {
  return {
    runtime: {
      eventTypes: [...SUPPORTED_RUNTIME_EVENT_TYPES],
      sessionApi: createSessionApiContract(),
    },
  };
}

export function createPluginStartContextContract(): PluginStartContext {
  return {
    runtime: {
      report: {
        adapterName: "mock",
        healthUrl: "http://127.0.0.1:3000/healthz",
        host: "127.0.0.1",
        instanceId: "placeholder-instance",
        port: 3000,
        startedAt: new Date().toISOString(),
        suitName: "placeholder-suit",
      },
    },
  };
}

export function createExposurePluginRegistry(): ExposurePluginRegistry {
  const plugins = new Map<string, ExposurePluginDefinition>();

  return {
    get(expose, adapter) {
      return plugins.get(toExposurePluginKey(expose, adapter));
    },
    list() {
      return [...plugins.values()];
    },
    register(plugin) {
      const key = toExposurePluginKey(
        plugin.manifest.expose,
        plugin.manifest.adapter,
      );

      if (plugins.has(key)) {
        throw new Error(
          `Exposure plugin "${plugin.manifest.expose}/${plugin.manifest.adapter}" is already registered.`,
        );
      }

      plugins.set(key, plugin);
    },
  };
}

export function createExposurePluginHost(
  options: ExposurePluginHostOptions = {},
): ExposurePluginHost {
  const registry = createExposurePluginRegistry();
  const env = options.env ?? process.env;
  const hostVersion = options.hostVersion ?? exposureHostVersion;
  const activePlugins: ExposurePlugin[] = [];
  const pluginApiRuntimeVersion = options.pluginApiVersion ?? pluginApiVersion;
  let discovered = false;

  async function discover(): Promise<ExposurePluginDefinition[]> {
    if (discovered) {
      return registry.list();
    }

    for (const source of options.sources ?? []) {
      const loadedModule = await source.load();
      const definitions = readExposurePluginDefinitions(
        source.id,
        loadedModule,
      );

      for (const definition of definitions) {
        validateExposurePluginDefinition(
          definition,
          hostVersion,
          pluginApiRuntimeVersion,
        );
        registry.register(definition);
      }
    }

    discovered = true;
    return registry.list();
  }

  return {
    async discover() {
      return await discover();
    },
    async resolve(expose, adapter) {
      await discover();
      const definition = registry.get(expose, adapter);

      if (!definition) {
        throw new Error(
          `No discovered exposure plugin provides "${expose}/${adapter}".`,
        );
      }

      return definition;
    },
    async startPlugins(selections, startOptions) {
      const startedThisCall: ExposurePlugin[] = [];

      try {
        for (const selection of selections) {
          const definition = await this.resolve(
            selection.expose,
            selection.adapter,
          );

          await validateExposurePluginConfig(definition, env);

          const plugin = await definition.create({ env });
          await plugin.setup(startOptions.pluginContext);
          await plugin.start(startOptions.startContext);

          startedThisCall.push(plugin);
          activePlugins.push(plugin);
        }

        return startedThisCall;
      } catch (error) {
        for (const plugin of [...startedThisCall].reverse()) {
          await plugin.stop();
          const index = activePlugins.indexOf(plugin);

          if (index >= 0) {
            activePlugins.splice(index, 1);
          }
        }

        throw error;
      }
    },
    async stopAll() {
      for (const plugin of [...activePlugins].reverse()) {
        await plugin.stop();
      }

      activePlugins.length = 0;
    },
  };
}

export function createExposurePluginContract(): ExposurePlugin {
  return {
    name: "placeholder-plugin",
    async setup() {},
    async start() {},
    async stop() {},
  };
}

function toExposurePluginKey(expose: string, adapter: string): string {
  return `${expose}:${adapter}`;
}

function readExposurePluginDefinitions(
  sourceId: string,
  loadedModule: unknown,
): ExposurePluginDefinition[] {
  if (
    loadedModule &&
    typeof loadedModule === "object" &&
    "exposurePluginDefinitions" in loadedModule &&
    Array.isArray(loadedModule.exposurePluginDefinitions)
  ) {
    return loadedModule.exposurePluginDefinitions as ExposurePluginDefinition[];
  }

  throw new Error(
    `Exposure plugin module "${sourceId}" does not export "exposurePluginDefinitions".`,
  );
}

function validateExposurePluginDefinition(
  definition: ExposurePluginDefinition,
  hostVersion: string,
  pluginApiRuntimeVersion: string,
): void {
  const { manifest } = definition;

  if (
    !manifest.name ||
    !manifest.expose ||
    !manifest.adapter ||
    !manifest.version
  ) {
    throw new Error("Exposure plugin manifest is incomplete.");
  }

  if (!satisfiesVersion(hostVersion, manifest.requires?.host)) {
    throw new Error(
      `Exposure plugin "${manifest.name}" is incompatible with host version ${hostVersion}.`,
    );
  }

  if (
    !satisfiesVersion(pluginApiRuntimeVersion, manifest.requires?.pluginApi)
  ) {
    throw new Error(
      `Exposure plugin "${manifest.name}" is incompatible with plugin API version ${pluginApiRuntimeVersion}.`,
    );
  }
}

async function validateExposurePluginConfig(
  definition: ExposurePluginDefinition,
  env: Record<string, string | undefined>,
): Promise<void> {
  await definition.manifest.config?.validate?.(env);
}

function satisfiesVersion(actualVersion: string, range?: string): boolean {
  if (!range || range === "*") {
    return true;
  }

  if (range.startsWith("^")) {
    const minimumVersion = range.slice(1);
    const actual = parseSemver(actualVersion);
    const minimum = parseSemver(minimumVersion);

    if (!actual || !minimum) {
      return false;
    }

    if (actual.major !== minimum.major) {
      return false;
    }

    return compareSemver(actual, minimum) >= 0;
  }

  return actualVersion === range;
}

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): ParsedSemver | undefined {
  const matched = /^(\d+)\.(\d+)\.(\d+)/u.exec(version);

  if (!matched) {
    return undefined;
  }

  const [, major, minor, patch] = matched;

  if (!major || !minor || !patch) {
    return undefined;
  }

  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
  };
}

function compareSemver(left: ParsedSemver, right: ParsedSemver): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
}
