export const exposurePluginDefinitions = [
  {
    async create() {
      return {
        name: "discovered-im-plugin",
        async setup() {},
        async start() {},
        async stop() {},
      };
    },
    manifest: {
      adapter: "discovered-discord",
      capabilities: ["streaming-text"],
      expose: "im",
      name: "@tests/discovered-im-plugin",
      requires: {
        host: "^0.1.0",
        pluginApi: "^0.1.0",
      },
      version: "0.1.0",
    },
  },
];
