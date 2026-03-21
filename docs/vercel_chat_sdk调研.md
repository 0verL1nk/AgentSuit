# Vercel Chat SDK 调研

## 1. 目的

本文档聚焦当前 Vercel 官方聊天前端方案，回答 AgentSuit 接 `plugin-chat / Vercel Chat SDK` 这条线时最关键的问题：

1. 现在官方推荐的“Chat SDK”到底是什么？
2. 前后端接口的核心抽象是什么？
3. 我们应该直接适配 `useChat`，还是自己做一层 transport？
4. AgentSuit 的 runtime event / session API 要怎么映射成它能消费的流？

本文基于 2026-03-21 可访问的 Vercel 官方 AI SDK 文档整理，优先使用官方页面：

- AI SDK UI Overview
- `useChat`
- Transport
- Stream Protocol
- Reading UIMessage Streams
- Message Metadata
- Chatbot Message Persistence
- Chatbot Resume Streams
- DirectChatTransport

## 2. 结论先行

### 2.1 现在真正该研究的不是“独立的 Chat SDK”，而是 AI SDK UI 的 `useChat`

从官方文档结构看，Vercel 当前围绕聊天 UI 的核心能力已经统一进 `AI SDK UI`，核心入口是：

- `useChat` from `@ai-sdk/react`
- `DefaultChatTransport` / `TextStreamChatTransport` / `DirectChatTransport` from `ai`

官方文档重点都在：

- AI SDK UI Overview: https://ai-sdk.dev/docs/ai-sdk-ui/overview
- `useChat`: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- Transport: https://ai-sdk.dev/docs/ai-sdk-ui/transport

我的判断：

- 业界口头上还会说 “Vercel Chat SDK”
- 但对当前落地来说，**应直接按 AI SDK UI / `useChat` 体系来设计**

这不是官方页面原话，而是根据当前官方产品结构做的工程判断。

### 2.2 `useChat` 的核心不是“hook”，而是一套 transport + `UIMessage` 协议

官方在 `useChat` 文档里明确说明，AI SDK 5 以后 `useChat` 采用 **transport-based architecture**，并且不再管理 input state。  
来源：

- `useChat`: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat

对 AgentSuit 的含义：

- 我们不应该把 `plugin-chat` 设计成“只支持某个 React hook”
- 应把它设计成“提供兼容 `useChat` transport / stream protocol 的服务端”
- 前端 React/Next.js 只是第一消费方

### 2.3 最关键的后端集成点是 Data Stream Protocol

官方 Stream Protocol 文档说明：

- `useChat` 支持 text stream 和 data stream
- data stream 使用 **SSE**
- 自定义后端要设置 `x-vercel-ai-ui-message-stream: v1`
- data stream 可以传文本、reasoning、tool 输入/输出、step、finish、abort、error 等结构化 part

来源：

- Stream Protocol: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol

对 AgentSuit 的含义：

- 我们完全可以不依赖 Vercel 的后端 helper，自己实现兼容协议
- 这正适合 AgentSuit 的 `plugin-chat` 路线：

```text
AgentSuit runtime events
  -> plugin-chat stream bridge
    -> AI SDK UI SSE data stream protocol
      -> useChat
```

### 2.4 对我们来说，HTTP transport 比 DirectChatTransport 更合理

官方提供两条路：

- `DefaultChatTransport`: HTTP POST 到 `/api/chat`
- `DirectChatTransport`: 在同进程里直接调用 agent

来源：

- Transport: https://ai-sdk.dev/docs/ai-sdk-ui/transport
- DirectChatTransport: https://ai-sdk.dev/docs/reference/ai-sdk-ui/direct-chat-transport

对 AgentSuit 的含义：

- `DirectChatTransport` 更适合同进程 demo、测试、单进程桌面应用
- AgentSuit 当前已经有 runtime host / Docker / plugin 抽象
- 所以我们的主路线应是：
  - **HTTP/SSE transport**
  - 由 `plugin-chat` 暴露 `/api/chat` 或兼容路径

### 2.5 `UIMessage` 才是对接点，不是 provider raw text

官方 `useChat` 文档明确：

- 前端状态的核心单位是 `UIMessage`
- 渲染推荐基于 `message.parts`
- `sendMessage`、`regenerate`、`addToolOutput`、`addToolApprovalResponse` 都围绕 `UIMessage`

来源：

- `useChat`: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat

对 AgentSuit 的含义：

- runtime event 不能只映射成纯文本 token
- `plugin-chat` 需要把 runtime 事件装配成 `UIMessage.parts`
- 至少要支持：
  - `text`
  - tool call / tool output
  - error
  - message metadata

## 3. 官方能力梳理

## 3.1 `useChat`

`useChat()` 的核心能力包括：

- 管理消息数组
- 发送新消息
- 中止当前流
- 恢复中断的流
- 添加 tool output
- 响应 tool approval
- 处理 finish / error / data callbacks

官方文档中的关键点：

- `sendMessage(...)` 发送用户消息
- `stop()` 中止当前 assistant streaming
- `resumeStream()` 恢复中断流
- `addToolOutput(...)` 添加工具执行结果
- `addToolApprovalResponse(...)` 响应工具审批
- `messages` 是 `UIMessage[]`
- `message.parts` 是推荐渲染入口

来源：

- `useChat`: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat

### 对 AgentSuit 的启发

我们的 `plugin-chat` 至少要覆盖：

- 用户消息提交
- assistant 流式文本返回
- interrupt 映射到 `stop()`
- 工具输出回填
- 审批事件回传

否则只能算一个“文本聊天室”，不是完整 `useChat` 兼容后端。

## 3.2 Transport

官方 transport 文档说明：

- 默认是 HTTP POST 到 `/api/chat`
- 可以通过 `prepareSendMessagesRequest` 改请求体和头
- 可以通过 `prepareReconnectToStreamRequest` 定制重连请求
- transport 设计目标就是允许接入 WebSocket、自定义协议、特殊鉴权或自定义后端

来源：

- Transport: https://ai-sdk.dev/docs/ai-sdk-ui/transport

对 AgentSuit 很重要的一点是：

> transport 层本来就是给“非 Vercel 原生后端”准备的。

所以我们不需要把 AgentSuit 后端伪装成某种 provider；只要遵守 `useChat` 期望的 transport / stream protocol 即可。

## 3.3 Stream Protocol

这是最关键的一页。

官方明确：

- text stream 只能传基础文本
- data stream 使用 SSE，适合结构化聊天流
- 自定义后端返回 data stream 时要设置 `x-vercel-ai-ui-message-stream: v1`

来源：

- Stream Protocol: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol

文档列出的典型 part 包括：

- `start`
- `text-start` / `text-delta` / `text-end`
- `reasoning-start` / `reasoning-delta` / `reasoning-end`
- `tool-input-start`
- `tool-input-delta`
- `tool-input-available`
- `tool-output-available`
- `start-step`
- `finish-step`
- `finish`
- `abort`
- `error`

### 对 AgentSuit 的建议

我们应优先做 **data stream protocol**，不要先做 text stream protocol。原因：

- text stream 无法承载 tool、approval、reasoning、metadata
- 而 AgentSuit 后面明确要接：
  - Claude tool / MCP
  - 审批
  - A2UI
  - 可能的 reasoning / source / step 数据

## 3.4 Reading UIMessage Streams

官方提供 `readUIMessageStream`，可以把 UIMessage chunk stream 还原成可消费的 `UIMessage` 流，用于：

- 终端 UI
- 自定义客户端
- 服务端处理

来源：

- Reading UIMessage Streams: https://ai-sdk.dev/docs/ai-sdk-ui/reading-ui-message-streams

对 AgentSuit 的含义：

- 不一定非要 React 前端才能消费这套协议
- 后续 A2A / CLI / terminal chat 也可以复用同一套流

这对我们很重要，因为 AgentSuit 并不只想做 web chat。

## 3.5 Message Metadata

官方支持 message-level metadata，并推荐在服务端通过 `messageMetadata` 回调注入：

- 创建时间
- model 信息
- token usage
- 用户上下文
- 性能指标
- finish reason

来源：

- Message Metadata: https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata

对 AgentSuit 的意义很大：

- 我们的 runtime 已经有 `provider.eventType`、`adapter.name`、`providerSessionId`
- 后续可以把这些挂进 `message.metadata`
- 这样前端既能渲染内容，也能拿到底层调试/观测信息

建议首批 metadata 包括：

- `runtimeSessionId`
- `providerSessionId`
- `adapterName`
- `providerEventType`
- `finishReason`
- `startedAt` / `completedAt`

## 3.6 Message Persistence

官方 Message Persistence 文档强调：

- 持久化时不要盲信数据库里的旧消息
- 服务端在带 tool calls / metadata / data parts 时应使用 `validateUIMessages`

来源：

- Chatbot Message Persistence: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence

对 AgentSuit 的含义：

- 如果我们以后做 chat 历史持久化，server 侧不能直接把历史消息原样喂回模型
- 应做：
  - schema validation
  - tool schema 对齐
  - metadata/data parts 校验

## 3.7 Resume Streams

官方说明：

- `useChat` 支持在页面刷新后恢复进行中的流
- 但 **stream resumption 与 abort 不兼容**

来源：

- Chatbot Resume Streams: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams

这点对 AgentSuit 很关键。

### 对 AgentSuit 的判断

当前 runtime 已经有 `interrupt(sessionId)`，这是我们的关键能力之一。  
因此第一版 `plugin-chat` **不建议优先做 resume streams**，因为：

- 我们更重视 interrupt/stop 的一致性
- resume 需要额外的 stream store（通常是 Redis 一类）
- 而官方明确说 resume 与 abort 有冲突

建议顺序：

1. 先做稳定的 interrupt / stop
2. 后面再评估是否为长任务场景单独做 resumable stream 模式

## 3.8 DirectChatTransport

官方文档里 `DirectChatTransport` 直接在同进程调用 agent，并明确说：

- 适合 SSR、测试、单进程 app
- **不支持 stream reconnection**

来源：

- DirectChatTransport: https://ai-sdk.dev/docs/reference/ai-sdk-ui/direct-chat-transport

### 对 AgentSuit 的判断

它适合我们两类场景：

- `plugin-chat` 的测试桩
- 本地 demo / storybook / playground

但不适合作为正式 runtime plugin 的主接口，因为它会把前端和 runtime 强耦合到同进程部署。

## 4. 对当前代码库的落地含义

## 4.1 当前 plugin-api 还太薄

当前 [packages/plugin-api/src/index.ts](/home/ling/AgentSuit/packages/plugin-api/src/index.ts) 只有：

- `setup(context)`
- `start()`
- `stop()`

以及 runtime 侧的：

- `sessionApi`
- `eventTypes`

这对最小插件足够，但对 `useChat` 还不够。

至少还缺几类能力：

- 事件到 `UIMessage.parts` 的标准映射
- 中断与 tool result / approval 回传
- chat session id 与 runtime session id 的绑定策略
- HTTP/SSE handler 约定
- 可选持久化接口

## 4.2 当前 runtime event 足够做 MVP，但不够做完整 useChat

当前 runtime 事件类型只有：

- `session.started`
- `message.delta`
- `message.completed`
- `session.failed`
- `session.completed`

这足够做纯文本 MVP，但对完整 `useChat` 不够，因为还缺：

- tool call 开始 / 输入 / 输出
- approval request / approval response
- reasoning
- finish reason
- richer metadata

### 建议

如果要走 `plugin-chat / Vercel Chat SDK`，runtime event contract 下一步应扩展，但要保持“runtime-owned normalized events”的原则，不能让插件直接吃 Claude raw event。

## 4.3 最合适的集成方式是 AgentSuit 自己实现兼容 data stream 协议

我不建议把 `plugin-chat` 做成：

- 直接把 Claude SDK 塞进 Next.js route
- 或前端直接消费 Claude adapter raw stream

更合理的是：

```text
useChat (frontend)
  -> DefaultChatTransport / custom transport
    -> plugin-chat HTTP endpoint
      -> AgentSuit runtime Session API
        -> selected adapter (claude-code first)
```

这样有几个好处：

- `plugin-chat` 只依赖 runtime contract，不依赖 Claude specifics
- 以后可切 Codex/OpenClaw 不动前端
- A2A / A2UI / terminal chat 可以复用 runtime event bridge

## 5. 推荐的第一版 plugin-chat 方案

## 5.1 MVP 目标

第一版只做：

- HTTP POST chat endpoint
- SSE data stream protocol
- 用户消息 -> runtime `sendInput`
- runtime 文本事件 -> `UIMessage` text parts
- `stop()` -> runtime `interrupt`
- message metadata 注入基础调试信息

不做：

- resume streams
- 完整 tool approval
- full generative UI
- 多会话持久化

## 5.2 建议的映射

### 请求侧

`useChat` -> `plugin-chat`：

- `id` -> chat thread id
- `messages` -> UIMessage[]
- 服务端挑最后一条 user message 送入 runtime
- 服务端内部维护 `chatId -> runtimeSessionId`

### 响应侧

AgentSuit runtime -> AI SDK data stream：

- `session.started`
  -> `start` + metadata
- `message.delta`
  -> `text-start` / `text-delta`
- `message.completed`
  -> `text-end` + `finish`
- `session.failed`
  -> `error`
- `session.completed`
  -> `finish`

### metadata

建议挂：

- `runtimeSessionId`
- `providerSessionId`
- `adapterName`
- `providerEventType`

## 5.3 中断

前端 `stop()`：

- 对应后端取消当前 streaming response
- 同时调用 runtime `interrupt(sessionId)`

这个能力是 AgentSuit 相比很多普通 chat backend 更值得保留的地方。

## 6. 风险与取舍

### 6.1 如果一开始只做 text stream，会很快返工

因为一旦接：

- tool usage
- MCP
- approvals
- A2UI

text stream 就不够了。

所以第一版虽然可以只渲染文本，但协议层最好一开始就上 **data stream**。

### 6.2 `useChat` 的抽象更新较快

从官方文档看，AI SDK 5 把 `useChat` 改成 transport 架构，AI SDK 6 仍在继续演进。  
这意味着：

- `plugin-chat` 应该尽量依赖稳定概念：
  - HTTP transport
  - UIMessage
  - SSE data stream protocol
- 少依赖某个 demo helper 或内部实现

### 6.3 Resume 与 Abort 的冲突

官方明确写了 resume stream 与 abort 不兼容。  
这会影响我们未来的产品决策：

- 如果要强可中断，先别上 resume
- 如果要强恢复长任务，就要接受 abort 行为受限或拆模式

## 7. 建议的下一步

### 7.1 先补文档级设计

建议下一份文档专门写：

- `plugin-chat` HTTP contract
- runtime event -> UIMessage part mapping
- interrupt / approval / tool output 语义
- chat session id / runtime session id 映射

### 7.2 再开实现 change

建议 change 范围控制在：

1. `packages/plugin-chat`
2. `packages/plugin-api` 扩展
3. `suit serve --expose chat`
4. 一个最小 Next.js / `useChat` demo 或 smoke

### 7.3 MVP 技术路线

推荐路线：

```text
React / Next.js frontend
  useChat + DefaultChatTransport
    -> /api/chat
      -> plugin-chat
        -> runtime session API
          -> claude-code adapter
```

不推荐第一版路线：

- 直接在前端使用 `DirectChatTransport`
- 直接对接 Claude SDK 而绕过 AgentSuit runtime
- 先做 text stream 再补 tool/approval

## 8. 最终判断

对 AgentSuit 来说，“Vercel Chat SDK” 最准确的研究对象其实是：

- **AI SDK UI**
- **`useChat`**
- **transport system**
- **UIMessage data stream protocol**

这套抽象和 AgentSuit 当前方向是高度契合的，因为：

- runtime 已经有 session API
- adapter 已经有规范化事件
- Docker 单机部署已经通
- 接下来只差把 runtime session 流翻译成 `useChat` 能消费的协议

也就是说，`plugin-chat` 不是从零发明聊天协议，而是做一个：

> AgentSuit runtime 到 AI SDK UI protocol 的桥接层

这条路线是现实、可维护、也最符合当前仓库状态的。

## 参考链接

- AI SDK UI Overview: https://ai-sdk.dev/docs/ai-sdk-ui/overview
- `useChat`: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- Transport: https://ai-sdk.dev/docs/ai-sdk-ui/transport
- Stream Protocol: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- Reading UIMessage Streams: https://ai-sdk.dev/docs/ai-sdk-ui/reading-ui-message-streams
- Message Metadata: https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata
- Chatbot Message Persistence: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- Chatbot Resume Streams: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
- DirectChatTransport: https://ai-sdk.dev/docs/reference/ai-sdk-ui/direct-chat-transport
