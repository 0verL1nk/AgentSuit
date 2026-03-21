## Why

AgentSuit 已经打通了 `claude-code` adapter、本地运行和 Docker 单机部署，但仍然缺少一个真正可交互的 IM 入口。先以 Discord 作为 `plugin-im-chat` 的首个平台，可以验证 “IM thread -> runtime session -> Claude stream -> IM reply” 这条完整链路，并为后续扩展到其他平台建立稳定抽象。

## What Changes

- 新增 `packages/plugin-im-chat`，基于 Vercel `chat` / Chat SDK 实现 Discord 首个平台的 IM plugin MVP。
- 实现 Discord thread/message 到 AgentSuit runtime session 的映射，并把 runtime 流式文本输出桥接到 Discord 回复流。
- 扩展 `suit serve`，支持显式启动 IM 暴露层并加载 Discord plugin 配置。
- 增加最小的 thread-session 映射、串行化或锁控制、失败回传与 stop/interrupt 行为。
- 补充 Discord 本地/Docker 配置文档与自动化测试，覆盖 happy path 和 failure path。

## Capabilities

### New Capabilities
- `im-chat-plugin-mvp`: 定义首个 IM plugin 的最小行为，范围收敛为 Discord 单平台、runtime session 桥接、流式文本回复和基础失败语义。

### Modified Capabilities
- `cli-foundation`: `suit serve` 需要支持显式启用 IM 暴露层及其基础配置入口。

## Impact

- Affected code: `packages/plugin-api`, `packages/plugin-im-chat`（new）, `packages/cli`, 可能少量涉及 `packages/runtime` 的插件宿主装配逻辑，以及对应测试与文档。
- APIs/systems: runtime plugin contract、`suit serve` 选项解析、Discord webhook 或 adapter handler 装配、thread/runtime session 映射。
- Dependencies: 引入 Vercel `chat` 生态中的核心包与 Discord adapter，原因是现有 workspace 中没有跨 IM 平台的 thread/channel/state/stream 抽象，手写会让首个平台实现过度耦合 Discord 细节，不利于后续扩展。
