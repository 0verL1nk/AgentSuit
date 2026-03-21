## Context

AgentSuit 已经具备 runtime host、`claude-code` adapter、本地/Docker 运行能力，但外部交互入口目前仍停留在 CLI 和 health endpoint。前面已经明确将聊天暴露层拆成两条线：

- `plugin-web-chat`：面向 AI SDK UI / `useChat`
- `plugin-im-chat`：面向 Vercel `chat` / Chat SDK

这次 change 只推进后者，并进一步把范围收敛为 Discord 首个平台。这样可以先验证最关键的链路：

`Discord thread -> Chat SDK -> AgentSuit runtime session -> Claude stream -> Discord reply`

当前仓库已有 `packages/plugin-api`，但 contract 仍然很薄；当前 runtime 事件也主要是文本事件，因此第一版更适合做 Discord 文本 streaming MVP，而不是一开始就覆盖卡片、按钮、审批或多平台适配。

## Goals / Non-Goals

**Goals:**
- 新增 `packages/plugin-im-chat`，用 Vercel Chat SDK 装配 Discord adapter。
- 让 Discord thread 能创建并复用 AgentSuit runtime session。
- 把 runtime `message.delta` / `message.completed` 桥接成 Discord 可消费的流式回复。
- 扩展 `suit serve` 以显式启用 IM 暴露层并注入 Discord 所需配置。
- 提供最小的失败处理、stop/interrupt 路径和本地/Docker 文档。

**Non-Goals:**
- 同时支持 Slack、Telegram、Teams 等多个平台。
- 实现 `plugin-web-chat` 或 AI SDK UI `useChat` 后端。
- 实现 Redis/Postgres 状态存储作为首发必需能力。
- 实现 cards、buttons、modals、slash commands 或 generative UI。
- 实现完整聊天历史持久化或流恢复。

## Decisions

### 1. 以 `packages/plugin-im-chat` 作为单独包实现 Discord 首个平台
IM bot 和 web chat 的协议、部署、状态模型完全不同，不能继续混成一个泛 `plugin-chat` 包。首版直接新增 `packages/plugin-im-chat`，只承载 Chat SDK 与 runtime 的桥接逻辑。

备选方案：
- 在 `packages/plugin-api` 中直接塞 Discord 逻辑：拒绝，破坏 API 与实现分层。
- 继续沿用一个泛 `plugin-chat` 包：拒绝，后续会把 web/useChat 与 IM webhook 两套模型混在一起。

### 2. 只选择 Discord 作为 Chat SDK 的首个平台
Discord adapter 已经足够验证 webhook、thread、streaming reply、message routing 这些核心路径，同时比一开始做多平台更易控。MVP 的重点是验证 AgentSuit runtime bridge，而不是覆盖平台矩阵。

备选方案：
- 同时做 Slack + Discord：范围过大，测试矩阵和配置复杂度都会翻倍。
- 先做 Slack：也可行，但当前用户已经明确“先实现 Discord”。

### 3. 采用 `thread.id -> runtimeSessionId` 的一对一映射
Chat SDK 已经提供统一的 `Thread` 抽象，所以 IM plugin 不需要再发明一层 conversation id。直接用 Discord thread id 作为会话映射 key，建立到 AgentSuit runtime session 的一对一绑定。

备选方案：
- `thread.id -> providerSessionId`：拒绝，插件会直接耦合 Claude provider。
- 每条消息都新建 runtime session：拒绝，会丢失持续对话语义。

### 4. 首版使用 Chat SDK 自带的 thread/state 模型，状态先用 memory
首版优先用 Chat SDK 官方 state adapter 的 memory 版本打通开发闭环。并发控制、thread 订阅和 lock 语义优先复用 Chat SDK，而不是在 AgentSuit 再做一层 webhook 消息总线。

备选方案：
- 首版就强制 Redis：不利于本地 MVP 与 `bun run check`。
- 完全自己维护 thread 锁：拒绝，和 Chat SDK 的状态模型重复。

### 5. 输出桥接先做文本 streaming，不做 platform-native 富交互
当前 runtime 只有规范化文本事件，因此首版以：

- `message.delta` -> `AsyncIterable<string>`
- `message.completed` -> stream finish
- `session.failed` -> error/fallback reply

桥接到 `thread.post(stream)` 即可。

备选方案：
- 一开始就做 cards/actions：拒绝，runtime 事件还不够丰富。
- 先不做流式、只做最终整段文本：拒绝，会损失 Chat SDK 的核心价值。

### 6. `suit serve` 增加 IM 暴露入口，但配置保持环境变量优先
Discord token、webhook secret、state backend 这类都属于 deployment secret，不应进 Suit。首版通过 `suit serve --expose im --im-adapter discord` 加环境变量完成装配。

备选方案：
- 把 Discord secrets 写进 Suit：拒绝，安全边界错误。
- 仅支持代码内硬编码配置：拒绝，不适合 Docker/cloud。

## Risks / Trade-offs

- [Chat SDK 仍处于 public beta] → 依赖 `Chat`、`Thread`、`Adapter`、`StateAdapter` 这些稳定概念，避免耦合内部实现。
- [Discord 平台能力与其他平台不完全一致] → 首版明确只承诺 Discord 文本 streaming 行为，不抽象成“所有平台完全一致”。
- [runtime 事件还不支持 tool/approval] → 首版只定义文本与失败路径；后续丰富 runtime event contract 再扩平台能力。
- [Memory state 不能支撑生产态部署] → 在设计中预留 state adapter 接口，后续用 Redis 替换而不改 runtime bridge。
- [同一 thread 的新消息和 runtime interrupt 语义可能冲突] → 首版不做自动抢占，只支持显式 stop/interrupt。

## Migration Plan

1. 新增 `packages/plugin-im-chat` 与最小的 Discord bridge。
2. 扩展 `plugin-api` / CLI 装配点，使 `suit serve` 能启用 IM 暴露层。
3. 增加本地集成测试和 Discord adapter mocked 测试。
4. 更新 Docker 和环境变量文档。
5. 后续如需生产化，再引入 Redis state adapter 与更多平台。

## Open Questions

- 首版是否要同时提供显式 `stop` 命令或 Discord action/button 来映射 runtime interrupt？
- Discord thread 的“继续会话”是否只依赖 `thread.subscribe()`，还是需要额外的 mention 策略控制？
- `plugin-im-chat` 是否需要在首版就暴露健康信息或平台连接状态到 runtime startup metadata？
