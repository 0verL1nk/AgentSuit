## Why

当前 Discord IM MVP 已经打通，但 `suit` 仍然在 CLI 内部内置注册 `im/discord`，这和 AgentSuit 想要的模块化、插件化方向冲突。现在需要把 channel 暴露层升级成“Suit 负责发现、校验、装配，具体 channel plugin 自带 manifest 和 factory”的宿主模式，避免每接一个新 IM 平台都要修改 `suit` 本体。

## What Changes

- 新增开放式 channel plugin discovery capability，让 exposure plugin 通过显式 manifest 和 factory 向宿主注册，而不是由 CLI 硬编码。
- 修改 runtime/plugin host contract，使宿主能够统一发现、校验、实例化、启动、停止 exposure plugins，并在启动失败时进行确定性回滚。
- 修改 `suit serve` 的 channel exposure 装配路径，使其只按 `--expose` 与 adapter key 查找插件定义，不再直接认识 Discord 具体实现。
- 为 plugin discovery 增加受控发现与校验规则，覆盖插件身份、版本要求、能力声明、配置 schema 和错误语义。
- 保持当前 Discord MVP 可继续工作，但将其重构为“通过开放注册表暴露的官方 plugin”。

## Capabilities

### New Capabilities
- `channel-plugin-discovery`: 定义 exposure/channel plugins 的 manifest、发现、校验、实例化和宿主生命周期装配能力。

### Modified Capabilities
- `cli-foundation`: `suit serve` 的 IM exposure 启动语义改为通过已发现的 channel plugin 定义进行装配，而不是由 CLI 内置平台分支。
- `runtime-extensibility-contracts`: exposure plugin contract 从“仅可 setup/start/stop 的实例接口”扩展为“带 manifest、requires、capabilities、config schema 的开放注册与宿主发现模型”。

## Impact

- Affected code: `packages/plugin-api`, `packages/cli`, 后续可能拆出的 plugin host/runtime host 装配层，以及 `packages/plugin-im-chat`
- Affected APIs: exposure plugin public contract、CLI channel exposure selection path、plugin registration/discovery semantics
- Dependencies: 不要求新增新的第三方动态插件框架，优先复用现有 Bun/TypeScript/workspace 包能力实现受控发现
- Systems: `suit serve` startup flow、plugin lifecycle management、future Slack/Telegram/Teams channel plugin onboarding
