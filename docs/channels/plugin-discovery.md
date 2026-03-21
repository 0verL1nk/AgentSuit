# Channel Plugin Discovery

本文档说明 AgentSuit 当前 channel plugin 的发现、校验、装配边界。

## 目标

`suit` 本体只负责四件事：

- 发现可用 channel plugins
- 校验 plugin definition 与 host/plugin-api 兼容性
- 按 `--expose` 与 adapter selector 装配 plugin
- 统一生命周期与失败回滚

`suit` 本体不直接硬编码 Discord、Slack、Telegram 等平台实现。

## 当前 discovery 边界

当前版本采用受控 discovery，而不是任意动态扫描。

优先级如下：

1. `AGENTSUIT_EXPOSURE_PLUGIN_MODULES`
   作用：显式指定要加载的 plugin modules，逗号分隔
2. workspace plugin 自动发现
   作用：当上面的环境变量为空时，扫描仓库 `packages/*/package.json`，加载名字匹配 `@agentsuit/plugin-*` 且不是 `@agentsuit/plugin-api` 的模块

这意味着：

- 新增官方 workspace plugin 时，`suit` 本体不需要改代码
- 测试或本地调试时，可以通过环境变量指向显式模块
- 当前不支持任意目录扫描、远程下载、插件市场

## Plugin Module Contract

一个可发现的 channel plugin module 必须导出：

```ts
export const exposurePluginDefinitions = [
  {
    manifest: {
      name: "@agentsuit/plugin-example",
      version: "0.1.0",
      expose: "im",
      adapter: "example",
      requires: {
        host: "^0.1.0",
        pluginApi: "^0.1.0",
      },
      capabilities: ["streaming-text"],
      config: {
        env: [{ name: "EXAMPLE_TOKEN", required: true }],
        validate(env) {
          // throw on invalid config
        },
      },
    },
    async create(options) {
      return createExamplePlugin(options);
    },
  },
];
```

宿主在 `create()` 之前就会校验：

- `expose/adapter` 唯一性
- `requires.host`
- `requires.pluginApi`
- `config.validate(env)`

任何一步失败，都会在 runtime startup 前或 plugin instantiation 前给出确定性错误。

## CLI Resolution

当前 contributor 路径保持不变：

```bash
./node_modules/.bin/suit serve <path> --expose im --im-adapter discord
```

区别在于，CLI 现在只做 selector 解析：

- `--expose im`
- `--im-adapter discord`

然后把 `im/discord` 交给 discovery host 去解析。

如果没有任何 discovered plugin 提供该 selector，会返回：

```text
No discovered exposure plugin provides "im/discord".
```

## Failure Semantics

如果 discovery module 没有导出 `exposurePluginDefinitions`：

```text
Exposure plugin module "<module-id>" does not export "exposurePluginDefinitions".
```

如果两个 plugins 同时声明相同的 `expose/adapter`：

```text
Exposure plugin "im/discord" is already registered.
```

如果 plugin 的 `requires` 与当前 host 或 plugin-api 不兼容：

```text
Exposure plugin "<name>" is incompatible with plugin API version <version>.
```

## 当前限制

- 仍然只内置了 Discord 这一条官方 channel plugin 实现
- 仍然没有第三方插件市场、签名校验或远程下载
- 当前 discovery 默认面向仓库内 workspace plugins 与显式 module 列表

这一步先解决“Suit 本体不需要为每个 channel plugin 改代码”，后续再扩到真正开放的第三方插件生态。
