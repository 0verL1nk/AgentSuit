# IM Plugin 设计文档

## 1. 目的

本文档定义 AgentSuit **IM plugin** 的设计方向。

这里的 IM plugin 指：

- 面向 Slack / Teams / Discord / Telegram / GitHub / Linear / WhatsApp 等聊天与协作平台
- 基于 Vercel **`chat` / Chat SDK**
- 用于把 AgentSuit runtime 暴露成跨平台 bot，而不是网页聊天 UI

这条线与前面的 web chat 方案是两条不同产品线：

- **web plugin**
  - 面向浏览器聊天 UI
  - 基于 AI SDK UI / `useChat`
- **im plugin**
  - 面向 IM / 协作平台 bot
  - 基于 Vercel `chat` / Chat SDK

本文只讨论后者。

建议包名直接定为：

- `packages/plugin-im-chat`

对应地，web 聊天入口建议命名为：

- `packages/plugin-web-chat`

这样可以保持聊天暴露层的命名对称，同时避免把 IM bot 和 web chat gateway 混进同一个 `plugin-chat` 包。

## 2. 截至 2026-03-21 的官方定位

截至 **2026-03-21**，Vercel 这两条产品线已经明显分开：

- 旧“Chat SDK”模板线已经转向 **Chatbot / AI SDK UI**
  - 偏网页聊天 UI
  - 来源：
    - https://vercel.com/blog/introducing-chat-sdk
    - https://ai-sdk.dev/docs/ai-sdk-ui/overview

- 新的 **`npm i chat` / Chat SDK**
  - 偏 IM / 协作平台 bot SDK
  - 来源：
    - https://vercel.com/changelog/chat-sdk
    - https://chat-sdk.dev

因此，对 AgentSuit 的建议是：

```text
plugin-web-chat -> AI SDK UI / useChat
plugin-im-chat  -> chat / Chat SDK
```

这不是官方逐字说法，而是基于当前 Vercel 官方产品结构做的工程判断。

## 3. Chat SDK 是什么

官方对 Chat SDK 的定位是：

- 一套 TypeScript library
- 一份 bot 逻辑
- 多平台复用

它的核心能力不是“网页聊天组件”，而是：

- 适配多 IM/协作平台的 webhook 与 API
- 统一 thread / message / channel 抽象
- 统一事件模型
- 可插拔 state adapter
- 流式消息发布
- JSX cards / modals / buttons

来源：

- Changelog: https://vercel.com/changelog/chat-sdk
- Creating a Chat Instance: https://chat-sdk.dev/docs/usage

## 4. 官方能力梳理

## 4.1 `Chat` 实例

`Chat` 是主入口。

官方文档说明，创建方式大致是：

```ts
import { Chat } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createRedisState } from "@chat-adapter/state-redis";

const bot = new Chat({
  userName: "mybot",
  adapters: {
    slack: createSlackAdapter(),
  },
  state: createRedisState(),
});
```

来源：

- Creating a Chat Instance: https://chat-sdk.dev/docs/usage

关键点：

- `adapters`: 一个或多个平台 adapter
- `state`: 状态适配器，负责订阅、锁、持久状态
- `webhooks`: 每个平台都会暴露一个 webhook handler
- `initialize()` / `shutdown()`: 生命周期方法

### 对 AgentSuit 的含义

AgentSuit 的 IM plugin 不该自己再发明一套 channel/router 抽象。  
合理做法是：

- `plugin-im-chat` 内部持有一个 `Chat` 实例
- 把 AgentSuit runtime 接到 `Chat` 的 handler 中

## 4.2 Threads / Messages / Channels

官方统一了三个核心概念：

- `Thread`
- `Message`
- `Channel`

来源：

- Threads, Messages, and Channels: https://chat-sdk.dev/docs/threads-messages-channels

### Thread

`Thread` 表示一个平台上的对话线程，提供：

- `post(...)`
- `subscribe()`
- `unsubscribe()`
- `isSubscribed()`
- `startTyping()`
- `messages` / `allMessages`
- `state`
- `schedule(...)`

### Message

`Message` 会被标准化，关键字段包括：

- `id`
- `threadId`
- `text`
- `formatted`
- `raw`
- `author`
- `metadata`
- `attachments`
- `isMention`

### Channel

`Channel` 表示承载 thread 的容器，支持：

- 列 threads
- 列 top-level messages
- 发 top-level message
- 拉 channel metadata

### 对 AgentSuit 的含义

这组抽象和我们 runtime 的关系应该是：

```text
Chat SDK thread
  <-> AgentSuit conversation key
  <-> runtime session
```

不是：

```text
Chat SDK thread
  <-> provider session directly
```

也就是说，Chat SDK thread 不应直接绑 Claude provider，而应先绑 AgentSuit runtime session。

## 4.3 事件驱动模型

官方文档说明，Chat SDK 采用事件驱动模型。常见入口有：

- `onNewMention`
- `onSubscribedMessage`
- `onNewMessage`
- reaction / slash command / action / modal 相关 handler

来源：

- Handling Events: https://chat-sdk.dev/docs/handling-events

其中路由顺序很关键：

1. subscribed thread
2. mention
3. pattern match

### 对 AgentSuit 的意义

这意味着 IM plugin 的对话接入天然适合做成：

- bot 被 mention 时，进入 AgentSuit runtime
- thread 订阅后，后续消息都走同一 runtime session

这个模型比我们自己手写 webhook router 更自然，也更符合多 IM 平台通用模式。

## 4.4 流式消息发布

官方文档说明：

- `thread.post()` 可以接受字符串
- 也可以接受 markdown / AST / card
- 也可以接受 `AsyncIterable<string>`
- 还能直接接受 AI SDK `fullStream` / `textStream`

来源：

- Posting Messages: https://chat-sdk.dev/docs/posting-messages
- Streaming: https://chat-sdk.dev/docs/streaming

特别关键的是：

- 对 Slack，支持 native streaming
- 对其他平台，通常是 post + edit fallback
- `streamingUpdateIntervalMs` 可以控制编辑节流
- `fallbackStreamingPlaceholderText` 可以控制占位文本

### 对 AgentSuit 的含义

这非常适合承接 AgentSuit runtime 的流式事件。

第一版 IM plugin 可以直接做：

- runtime `message.delta` -> `AsyncIterable<string>`
- `thread.post(stream)`

也就是说，对 IM plugin 而言，AgentSuit runtime 输出的最小兼容层可以先是：

```text
runtime event stream -> text async iterable -> Chat SDK thread.post()
```

这条线比 web plugin 更简单，因为不需要一上来就实现 AI SDK UI data stream protocol。

## 4.5 State adapter 与锁

官方文档说明：

- Chat SDK 使用 state adapter 管订阅和锁
- 提供：
  - Redis
  - ioredis
  - PostgreSQL
  - Memory

来源：

- Creating a Chat Instance: https://chat-sdk.dev/docs/usage
- Adapters Directory: https://chat-sdk.dev/adapters

另外，`Chat` 配置里有：

- `onLockConflict: 'drop' | 'force' | fn`

官方说明：

- `'force'` 可释放现有锁并重新获取，用于长任务的 interrupt/steerability

来源：

- Creating a Chat Instance: https://chat-sdk.dev/docs/usage

### 对 AgentSuit 的意义

这点非常重要。

对 web plugin，我们之前准备自己实现 per-thread queue。  
但对 IM plugin，**更优先的选择是复用 Chat SDK 的 thread-level locking 机制**，而不是自己额外再做一套并发控制。

换句话说：

- IM plugin 的串行化和冲突控制，应优先交给 Chat SDK state adapter
- AgentSuit runtime 保持 session-level 语义

这样职责更清晰。

## 4.6 Adapter 生态

截至 **2026-03-21**，官方 adapter directory 显示：

- 官方平台 adapters:
  - Slack
  - Teams
  - Google Chat
  - Discord
  - GitHub
  - Linear
  - Telegram
  - WhatsApp
- 官方 state adapters:
  - Redis
  - ioredis
  - PostgreSQL
  - Memory
- Vendor official:
  - Matrix
  - iMessage
  - Resend Email

来源：

- Adapters Directory: https://chat-sdk.dev/adapters

### 对 AgentSuit 的意义

这对我们是利好：

- 第一版不需要先挑一个平台 hardcode 进业务层
- IM plugin 可以设计成：
  - AgentSuit plugin 宿主
  - 内部装配一个或多个 `chat` adapters

例如：

```text
plugin-im-chat
  -> Chat instance
    -> slack adapter
    -> discord adapter
    -> telegram adapter
```

## 5. 对 AgentSuit 的架构定位

## 5.1 IM plugin 的角色

IM plugin 的正确定位不是“消息平台 adapter”，而是：

> AgentSuit runtime 和 Vercel Chat SDK 之间的桥接层。

具体职责：

- 装配 Chat SDK instance
- 注册平台 adapters
- 处理 webhook
- 把 thread 事件转 runtime session 输入
- 把 runtime 输出转平台回复

## 5.2 不应该做的事

IM plugin 不应该：

- 直接调用 Claude Agent SDK
- 直接感知 Claude provider session 细节
- 维护独立于 runtime 的 conversation truth
- 重新实现平台 webhook 验签与格式转换

这些应该分别留给：

- runtime / adapter 层
- Chat SDK platform adapters

## 6. 建议的包与模块设计

建议新增：

```text
packages/plugin-im-chat/
  src/
    index.ts
    plugin.ts
    bot.ts
    handlers.ts
    runtime-bridge.ts
    session-map.ts
    transport-types.ts
    config.ts
```

### 6.1 `bot.ts`

职责：

- 创建 Chat SDK `Chat` 实例
- 根据配置挂载一个或多个 platform adapters
- 根据配置选择 state adapter

### 6.2 `handlers.ts`

职责：

- 注册：
  - `onNewMention`
  - `onSubscribedMessage`
  - action/button handlers
  - slash command handlers

### 6.3 `runtime-bridge.ts`

职责：

- 把 `Thread` / `Message` 转成 runtime 输入
- 把 runtime event stream 转成 `thread.post(...)` 可消费的流
- 处理 interrupt / failure / session cleanup

### 6.4 `session-map.ts`

职责：

- `thread.id -> runtimeSessionId`
- 可选保留 `providerSessionId` 作为 metadata

注意：

- Chat SDK 已经有 thread 概念
- 所以这里不需要像 web plugin 那样再发明 `chatThreadId`
- 直接用 `thread.id` 作为 key 即可

## 7. 线程与会话映射

建议第一版采用：

```text
thread.id <-> runtimeSessionId
```

行为规则：

1. 首次 mention 时创建 runtime session
2. 调 `thread.subscribe()`
3. 后续 `onSubscribedMessage` 继续发送到同一 runtime session
4. `session.failed` 时清理映射并在 thread 中告知失败
5. `session.completed` 是否清理取决于产品模式

### 第一版建议

- 默认**不立刻清理**
- 允许同一 thread 持续对话
- 增加空闲超时或显式 reset 命令作为后续能力

## 8. 输入输出桥接

## 8.1 输入侧

### `onNewMention(thread, message)`

流程：

1. 创建 runtime session
2. `thread.subscribe()`
3. 发送第一条用户输入

### `onSubscribedMessage(thread, message)`

流程：

1. 查 `thread.id -> runtimeSessionId`
2. 调 runtime `sendInput`
3. 把 runtime 流输出回 thread

## 8.2 输出侧

第一版建议先做文本桥接：

- `message.delta` -> string chunk
- `message.completed` -> stream finish
- `session.failed` -> error message / fallback text

实现方式：

```text
runtime streamEvents(sessionId)
  -> async iterable<string>
  -> thread.post(stream)
```

### 为什么先做文本桥接

因为 Chat SDK 天然把流式文本发布抽象得很好，而 AgentSuit 当前 runtime event 也主要是文本事件。  
所以 IM plugin MVP 完全可以先走：

- 文本 streaming
- 卡片/按钮留到第二阶段

## 8.3 后续输出升级

第二阶段可考虑：

- `thread.post(Card(...))`
- 平台按钮 / action handlers
- Slack native structured `StreamChunk`
- task progress / plan updates

但这要求 runtime event contract 增加更丰富的 step / tool / task 事件。

## 9. 中断与可打断性

这部分要特别谨慎。

Chat SDK 有 thread locking，且 `onLockConflict: 'force'` 能帮助处理长任务中断/steering。  
但 AgentSuit runtime 也有自己的：

- `interrupt(sessionId)`

### 设计建议

第一版语义定成：

- 新消息到达同一已占用 thread 时
  - 默认 `drop`
  - 不自动打断正在执行的任务

后续增强版可支持：

- 显式 “stop” action/button/slash command
  -> 调 runtime `interrupt`
- 或平台上新的 mention/message 触发 `force`

### 为什么第一版不直接 force

因为不同平台的用户预期差异很大：

- 有的平台新消息意味着插话
- 有的平台新消息只是补充上下文

如果第一版就默认强制抢锁，容易把对话语义搞乱。

## 10. 状态存储设计

IM plugin 强烈建议优先支持两档 state adapter：

### 10.1 开发态

- `@chat-adapter/state-memory`

### 10.2 生产态

- `@chat-adapter/state-redis`

原因：

- webhook 场景天然更需要持久订阅和分布式锁
- 单进程内存态只适合 demo

对 AgentSuit 的建议：

- 插件配置层要允许 state adapter pluggable
- 默认开发环境用 memory
- Docker/cloud 文档优先给 Redis 示例

## 11. 配置设计

建议 IM plugin 第一版采用环境变量优先的装配方式。

例如：

```text
AGENTSUIT_IM_ADAPTERS=slack,discord
AGENTSUIT_IM_STATE=memory|redis

SLACK_BOT_TOKEN=...
SLACK_SIGNING_SECRET=...
DISCORD_TOKEN=...
REDIS_URL=...
```

后续再考虑写进 Suit 或独立 plugin config。

### 为什么第一版不写进 Suit

因为：

- 平台 token / signing secret 显然不是 Suit 内容
- 它们属于 deployment/runtime secret

所以更合理的位置是：

- deployment env
- runtime plugin config

## 12. 与 `suit serve` 的集成

后续建议扩展：

```bash
suit serve <path> --base-agent claude-code --expose im
```

或更细化：

```bash
suit serve <path> --base-agent claude-code --expose im --im-adapters slack,discord
```

这样：

- runtime 负责 Claude session
- IM plugin 负责 webhook / thread / reply

## 13. 与 web plugin 的边界

必须明确：

### web plugin

- 建议包名：`packages/plugin-web-chat`
- HTTP chat API
- 浏览器会话
- `useChat`
- SSE data stream protocol

### im plugin

- 建议包名：`packages/plugin-im-chat`
- webhook 接收
- platform thread/channel 抽象
- `thread.post()`
- adapter-specific feature matrix

共享层只有：

- runtime session API
- normalized runtime events

不能混成一个泛 `plugin-chat` 包，否则很快会：

- 协议混乱
- 配置混乱
- 依赖变重
- 维护边界不清

## 14. 测试建议

### 14.1 单元测试

覆盖：

- `thread.id -> runtimeSessionId` 映射
- mention -> subscribe -> session create
- subscribed message -> runtime sendInput
- runtime delta -> `thread.post(stream)` bridge

### 14.2 插件集成测试

用 memory state adapter + fake platform adapter 覆盖：

- webhook -> handler routing
- thread locking
- failure cleanup

### 14.3 真实平台 smoke

后续再做：

- Slack
- Discord
- Telegram

不要一开始就把多平台 live 测试塞进默认质量门。

## 15. 风险与取舍

### 15.1 Chat SDK 仍是 public beta

截至 **2026-03-21**，Vercel Chat SDK 还是公开 beta。  
所以：

- 不要过度耦合内部行为
- 尽量依赖稳定抽象：
  - `Chat`
  - `Thread`
  - `Adapter`
  - `StateAdapter`

### 15.2 多平台能力不一致

官方 feature matrix 明确不同平台对：

- streaming
- cards
- modals
- ephemeral messages
- history

支持差异很大。

因此第一版 IM plugin 必须坚持：

- **capability degrade is normal**
- 先保证统一文本对话闭环

### 15.3 锁与 runtime interrupt 的语义冲突

如果 IM 平台线程锁和 runtime interrupt 设计不好，容易出现：

- 平台端认为任务已抢占
- runtime 端实际还在跑

所以中断语义必须单点收敛在 runtime，而不是散落在平台 adapter。

## 16. 建议的推进顺序

建议按这条顺序推进：

1. 先写 `plugin-im-chat` 设计与 OpenSpec
2. 第一版只选 **一个官方平台 adapter**
   - 建议 Slack 或 Discord
3. 先用 `state-memory` 打通本地开发闭环
4. 再补 `state-redis` 作为部署态
5. 再扩展第二个平台，验证多 adapter 装配

### 为什么第一版只选一个平台

因为：

- Chat SDK 已帮我们统一了平台抽象
- 第一版主要验证的是 AgentSuit runtime bridge
- 不需要一开始就承担多平台差异复杂度

## 17. 最终判断

对 AgentSuit 来说，IM plugin 的最佳定位是：

> 使用 Vercel Chat SDK 作为多平台 bot 外壳，把 AgentSuit runtime 作为统一智能体后端。

因此第一版设计原则应是：

```text
runtime-first
thread-centric
adapter-agnostic
text-stream-first
state-adapter-aware
```

而不是：

```text
provider-first
platform-specific-first
multi-feature-first
```

这条路线最符合当前仓库现状，也最有机会快速打通：

- Claude adapter
- runtime session
- IM thread
- Docker 部署

这四条链路。

## 参考链接

- Introducing `npm i chat`: https://vercel.com/changelog/chat-sdk
- Adapter directory: https://vercel.com/changelog/chat-sdk-adapter-directory
- Chat SDK docs: https://chat-sdk.dev
- Creating a Chat Instance: https://chat-sdk.dev/docs/usage
- Threads, Messages, and Channels: https://chat-sdk.dev/docs/threads-messages-channels
- Handling Events: https://chat-sdk.dev/docs/handling-events
- Posting Messages: https://chat-sdk.dev/docs/posting-messages
- Streaming: https://chat-sdk.dev/docs/streaming
- Building a community adapter: https://chat-sdk.dev/docs/contributing/building
