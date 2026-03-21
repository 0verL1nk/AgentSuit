## Context

当前 `implement-discord-im-plugin-mvp` 已经让 `packages/plugin-im-chat` 通过 `suit serve --expose im --im-adapter discord` 工作起来，但宿主层仍然在 CLI 中内置注册 `im/discord`。这会导致每新增一个 channel/plugin 都要修改 `suit` 本体，违背 AgentSuit 已经明确的模块化和插件化方向。

仓库现状已经具备三个可复用基础：

- `@agentsuit/plugin-api` 已经有 `ExposurePlugin` 和初始 registry 语义
- `packages/plugin-im-chat` 已经是独立实现包
- `suit serve` 已经具备 runtime host 启停、失败回滚、显式 expose 参数解析

因此下一步不是再加一个平台分支，而是把宿主抽成“发现、校验、装配”的 channel plugin host，让 Discord 成为第一 个通过开放定义接入的官方 plugin。

## Goals / Non-Goals

**Goals:**
- 让 `suit` 本体不再硬编码具体 channel plugin 的实现细节。
- 为 exposure/channel plugins 定义稳定的 definition/manifest 契约，包括身份、版本要求、能力、配置 schema 与 factory。
- 让宿主通过受控 discovery 机制加载可用 plugins，并在启动前完成校验。
- 保持 `suit serve` 的 deterministic failure 语义，并支持 plugin 启动失败回滚。
- 让 Discord 迁移到新宿主模型下工作，为后续 Slack/Telegram/Teams 复用同一条接入路径。

**Non-Goals:**
- 本次不做远程插件市场、签名校验或自动下载。
- 本次不做任意目录扫描或不受控代码执行。
- 本次不新增第二个 IM 平台实现。
- 本次不改变 runtime session、thread mapping、Claude adapter 语义。

## Decisions

### 1. 采用“受控 discovery”而不是“任意动态扫描”
宿主将只从显式声明的模块来源中发现 exposure plugins，例如：

- workspace 依赖中的官方 plugin 模块
- 明确传入的 plugin module 列表
- 后续可扩展的配置文件声明

这样可以满足“新增 plugin 时 Suit 本体不需要改代码”，同时避免宿主对文件系统或全局包环境做不透明扫描。

备选方案：
- 继续把 plugin 注册写死在 CLI：拒绝，扩展一次改一次本体。
- 扫描全仓库或全局 `node_modules`：拒绝，边界过宽，错误语义和安全性都差。

### 2. 在 `plugin-api` 中引入 definition/manifest 契约，而不仅是 plugin instance
当前 `ExposurePlugin` 只描述实例生命周期，还不够支撑开放发现。新模型应由 plugin 模块导出 definition，例如：

- `kind/expose/adapter/name/version`
- `requires`
- `capabilities`
- `configSchema`
- `create(options)`

宿主先消费 definition，再决定是否创建实例。

备选方案：
- 把 manifest 写在 README 或普通对象里由 CLI 自己猜：拒绝，无法稳定校验。
- 只有实例接口没有 definition：拒绝，宿主无法在 create 前做兼容性和配置检查。

### 3. 把 discovery / validation / lifecycle orchestration 收敛为宿主职责
宿主负责：

- 发现候选 plugin definitions
- 校验 expose/adapter 唯一性
- 校验 `requires` 与 host/plugin-api 兼容性
- 校验配置 schema
- 按选择结果实例化并 `setup/start/stop`
- 启动失败时回滚已启动实例

plugin 只负责自己的 channel 行为，不拥有发现逻辑，也不绕过宿主自行启动。

备选方案：
- 让 plugin 自己发现自己并自启动：拒绝，生命周期失控。

### 4. `suit serve` 只保留选择语义，不保留平台实现分支
CLI 只解析：

- `--expose <kind>`
- `--im-adapter <adapter>` 或后续更统一的 adapter selector

然后把选择交给 plugin host 去解析 `im/discord -> plugin definition`。CLI 不再 import Discord 具体实现，也不保留 `if (discord)` 之类的平台分支。

备选方案：
- 让 CLI 直接 import 每个平台模块：拒绝，会持续回到内置分支模式。

### 5. 首版先支持“官方受控开放”，第三方完全开放留到后续
这次先实现“新增官方或本地 workspace plugin 时，Suit 本体不需要改代码”。第三方生态还需要签名、来源、兼容矩阵等治理能力，应放在下一阶段。

备选方案：
- 这次一步做到远程第三方开放插件市场：拒绝，范围过大，安全边界不清。

## Risks / Trade-offs

- [Discovery 来源过宽] → 首版只允许显式来源，禁止任意扫描。
- [Definition 契约过薄，后续还会返工] → 从一开始纳入 `requires/capabilities/configSchema/create`，避免再次破口。
- [CLI 参数和 plugin host 选择语义耦合] → 保持 CLI 只传结构化 selector，不理解 plugin 内部实现。
- [开放发现后错误面增加] → 所有 discovery/validation failures 都要求 deterministic message 和 non-zero exit。
- [第三方开放需求会继续增加] → 在设计上预留来源校验与签名挂点，但这次不实现。

## Migration Plan

1. 扩展 `@agentsuit/plugin-api`，新增 exposure plugin definition/manifest/discovery contract。
2. 新增宿主侧 discovery/validation 装配模块，并把当前内置 Discord 注册迁移进去。
3. 修改 `packages/plugin-im-chat`，从“导出 createDiscordImPlugin”扩展为“导出可发现的 plugin definition”。
4. 修改 `suit serve`，通过 plugin host 选择并启动 exposure plugins。
5. 增加 discovery、validation、rollback 与 CLI failure tests。
6. 文档更新，说明如何接入新的官方 plugin module，以及后续第三方接入边界。

## Open Questions

- 首版 discovery 的显式来源是环境变量、配置文件，还是 workspace 依赖解析，优先级如何定义？
- `--im-adapter` 是否应在下一轮统一为 `--adapter`，避免 future expose kinds 再造一套参数？
- `configSchema` 是用纯 TypeScript validator 还是轻量 schema object 表达，才能在不引入重依赖的前提下保持稳定？
