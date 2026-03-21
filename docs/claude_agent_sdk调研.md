# Claude Agent SDK 调研

## 1. 目的

本文档聚焦 Anthropic 官方 `Claude Agent SDK`，目标是把这套 SDK 的能力边界、运行模型、接口形态和对 AgentSuit 的落地含义摸清楚，作为后续完善 `adapter-claude-code`、`plugin-chat`、A2A/A2UI 与容器部署方案的基础。

本文基于 2026-03-21 可访问的 Anthropic 官方文档整理，优先参考：

- Agent SDK Overview
- TypeScript SDK Reference
- Sessions
- Streaming Input
- Streaming Output
- Permissions
- User Input
- Hooks
- MCP
- Subagents
- Plugins
- Hosting
- Migration Guide

如果某个结论是从多篇文档综合推断出的，我会明确标成“推断”。

## 2. 结论先行

### 2.1 这不是普通模型 SDK，而是 Claude Code 运行时的程序化封装

Claude Agent SDK 不是简单的 “prompt -> HTTP -> text” 客户端。官方定义是“使用 Claude Code 作为库构建生产级 AI 智能体”，并明确说明它提供与 Claude Code 相同的工具、agent loop 和上下文管理。  
来源：

- Overview: https://platform.claude.com/docs/en/agent-sdk/overview

对 AgentSuit 的含义：

- `adapter-claude-code` 的正确定位不是“Anthropic 文本接口适配器”
- 它本质上是 “Claude Code runtime bridge”
- 我们的 runtime session 模型应围绕“长生命周期 agent process / session”设计，而不是围绕一次性 completion 设计

### 2.2 官方推荐优先使用 Streaming Input Mode

官方文档明确写了两种输入模式：

- Streaming Input Mode: 默认且推荐
- Single Message Input: 简单但能力受限

Streaming Input Mode 支持：

- 长生命周期会话
- 中断
- 权限请求
- 会话管理
- 完整工具访问
- hooks
- 实时反馈

Single Message Input 不支持：

- 直接图片附件
- 动态消息排队
- 实时中断
- hook 集成
- 自然多轮对话

来源：

- Streaming Input: https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode

对 AgentSuit 的含义：

- 当前我们基于 stable `query()` 的单次 prompt 封装，只能算 MVP
- 如果后面要做真正可交互的 `plugin-chat / Vercel Chat SDK`，应逐步切到官方推荐的 streaming input 形态
- A2UI / chat transport 要设计成“长连接 + 会话内多次输入”，而不是每轮重建 query

### 2.3 Session 是一等能力，且默认持久化到磁盘

官方把 session 定义为 SDK 自动积累的会话历史，包含 prompt、工具调用、工具结果和响应，并默认写入磁盘，后续可以 `continue`、`resume`、`fork`。  
来源：

- Sessions: https://platform.claude.com/docs/en/agent-sdk/sessions

对 AgentSuit 的含义：

- Claude 侧天然有“会话状态”，而不是 stateless chat
- AgentSuit 的 `runtimeSessionId` 与 Claude `session_id` 应该视为两层 ID
- 我们后续需要决定：
  - 是让 Claude native session 成为主 session
  - 还是由 AgentSuit 维护 canonical session，再把 Claude session 作为 provider session

当前更稳妥的做法仍然是后者。

### 2.4 Agent SDK 能力面很广，不该全部塞进 adapter 首版

官方能力面包括：

- 内置工具
- Hooks
- Permissions
- Sessions
- MCP
- Subagents
- Plugins
- Filesystem settings

来源：

- Overview: https://platform.claude.com/docs/en/agent-sdk/overview
- TypeScript Reference: https://platform.claude.com/docs/en/agent-sdk/typescript

对 AgentSuit 的含义：

- `adapter-claude-code` 只适合承接 runtime-specific 生命周期与 native capability 映射
- 不能把 memory、skill catalog、chat transport、approval UI、审计系统都硬塞到 adapter 里
- 更合理的边界仍然是：
  - adapter 负责接 Claude runtime
  - plugin/provider 负责补位和产品化

### 2.5 Agent SDK 与容器部署天然契合

官方 Hosting 文档明确建议：

- 在容器沙箱中运行 SDK
- Node.js 18+
- Node.js 之外还需要 Claude Code CLI
- 推荐资源基线
- 通过容器暴露 HTTP/WebSocket 端点与外部通信

来源：

- Hosting: https://platform.claude.com/docs/en/agent-sdk/hosting

对 AgentSuit 的含义：

- 我们当前 “single-host docker first” 的路线是正确的
- `suit serve + docker run` 正好对齐官方推荐的 hosting 方向
- 后续 `plugin-chat` 或 web/chat exposure 可以直接作为容器外暴露层

## 3. Claude Agent SDK 是什么

官方对它的定义是：

- 使用 Claude Code 作为库
- 可在 Python 和 TypeScript 中编程使用
- 提供与 Claude Code 相同的工具、agent loop 和上下文管理

它和普通模型 SDK 的本质区别是：

```text
普通模型 SDK
  prompt -> model API -> text

Claude Agent SDK
  prompt/input stream
    -> Claude Code runtime
      -> tools / bash / file ops / MCP / hooks / permission system
        -> result stream + session state
```

这意味着它更像“可编程 agent runtime”，而不是“聊天补全客户端”。

## 4. 输入模式

### 4.1 Streaming Input Mode

官方推荐模式。适合：

- chat UI
- 长任务
- 中途插话
- 实时中断
- 持续权限审批
- 多轮 session

TypeScript 可以把 `prompt` 传成一个 `AsyncIterable<SDKUserMessage>`，让 agent 持续接收用户消息。  
来源：

- Streaming Input: https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode

### 4.2 Single Message Input

适合：

- one-shot 查询
- 无状态环境
- 简单离线任务

但不适合：

- 真正聊天产品
- 中断控制
- hook-rich 的复杂工作流

### 4.3 对 AgentSuit 的建议

建议分两阶段：

1. `adapter-claude-code` 保留当前 stable `query()` 封装，先把 session/event/interrupt 路打稳
2. `plugin-chat` 与 A2UI 接入时，升级为 streaming input 主路径

这也是当前产品节奏里最稳妥的拆分。

## 5. 事件流与会话模型

### 5.1 `query()` 返回的是异步消息流

TypeScript 的 `query()` 返回 `Query`，它本身是 `AsyncGenerator<SDKMessage, void>`，同时还带控制方法，例如：

- `interrupt()`
- `setPermissionMode()`
- `setModel()`
- `initializationResult()`
- `setMcpServers()`
- `close()`

来源：

- TypeScript Reference: https://platform.claude.com/docs/en/agent-sdk/typescript

### 5.2 常见消息类型

官方文档和类型参考表明，常见输出包括：

- `system/init`
- `assistant`
- `result/success`
- `result/error_*`
- `auth_status`
- `stream_event`（启用 partial streaming 时）

当前我们已经在本仓库里验证了最基本链路：

- `assistant` -> 归一化为 `message.delta`
- `result/success` -> 归一化为 `message.completed`

### 5.3 Session 默认持久化

官方明确说明 session 会写盘，且 TypeScript stable V1 通过 `continue: true` 自动接最近 session。  
来源：

- Sessions: https://platform.claude.com/docs/en/agent-sdk/sessions

### 5.4 对 AgentSuit 的建议

AgentSuit 后续可以区分三层状态：

- `runtimeSessionId`: AgentSuit runtime 对外主键
- `providerSessionId`: Claude session_id
- `pluginConversationId`: chat/web 层面的会话 ID

这样 runtime、provider、exposure 三层解耦会更稳。

## 6. 工具、权限与审批

### 6.1 内置工具是第一层能力

Overview 和 TypeScript 文档都表明 SDK 内置了大量 Claude Code 工具，例如：

- Read
- Write
- Edit
- Bash
- Glob
- Grep
- WebSearch
- WebFetch
- AskUserQuestion
- 以及更多 Claude Code 原生工具

来源：

- Overview: https://platform.claude.com/docs/en/agent-sdk/overview
- TypeScript Reference: https://platform.claude.com/docs/en/agent-sdk/typescript

### 6.2 权限求值顺序非常重要

官方权限文档给出明确顺序：

1. Hooks
2. Deny rules
3. Permission mode
4. Allow rules
5. `canUseTool`

来源：

- Permissions: https://platform.claude.com/docs/en/agent-sdk/permissions

这意味着：

- 不能把 `canUseTool` 当成唯一权限入口
- hooks 可以更早拦截风险操作
- `dontAsk` 模式会跳过 `canUseTool`

### 6.3 用户输入和审批不是普通聊天消息

官方说明 Claude 需要用户输入主要有两类：

- 工具审批
- `AskUserQuestion`

两者都通过 `canUseTool` 回调进入应用层。  
来源：

- User Input: https://platform.claude.com/docs/en/agent-sdk/user-input

对 AgentSuit 的含义：

- `plugin-chat` 不能只渲染 assistant text
- 它必须支持审批事件和结构化提问事件
- A2UI 很适合承接这类结构化 UI 交互

## 7. Hooks

Hooks 是 SDK 最值得重视的能力之一。

官方定义：

- hooks 是在 agent lifecycle 关键节点运行的回调
- 可用于阻止危险操作、审计、变换输入输出、要求人工审批、追踪 session 生命周期

常见事件包括：

- `PreToolUse`
- `PostToolUse`
- `UserPromptSubmit`
- `Stop`
- `SubagentStart` / `SubagentStop`
- `PreCompact`

来源：

- Hooks: https://platform.claude.com/docs/en/agent-sdk/hooks
- Agent loop: https://platform.claude.com/docs/en/agent-sdk/agent-loop

对 AgentSuit 的含义：

- Suit 的 policy / audit / secret redaction / file path rewriting 很适合优先映射到 hooks
- 相比把逻辑写进 prompt，hooks 更可控、更不消耗上下文
- 后续“注入”能力应优先分两类：
  - prompt-level injection
  - hook-level injection

## 8. MCP

官方 MCP 指南说明：

- 可在 `query()` 里直接传 `mcpServers`
- 也可通过 `.mcp.json` 自动加载
- MCP 工具要通过 `allowedTools` 放开，例如 `mcp__servername__*`

来源：

- MCP: https://platform.claude.com/docs/en/agent-sdk/mcp

对 AgentSuit 的含义：

- runtime 传给 adapter 的 MCP 配置是合理方向
- AgentSuit 可以把 Suit tool declarations 优先映射成 `mcpServers`
- plugin-backed tool provider 也可以通过 MCP 暴露给 Claude

当前仓库已经实现了最小的 runtime -> adapter `mcpServers` 透传，这条方向是对的。

## 9. Subagents

官方 Subagents 文档明确：

- 可以 programmatic 定义 `agents`
- 也可以走 `.claude/agents/`
- 还存在内置 `general-purpose` subagent

收益包括：

- 上下文隔离
- 并行化
- 专业化提示词
- 工具限制

来源：

- Subagents: https://platform.claude.com/docs/en/agent-sdk/subagents

对 AgentSuit 的含义：

- Suit 的 `coworkers` / `agents` 模型可以映射到 Claude subagents
- 但不建议在 MVP 就做全量对齐
- 适合在后续 adapter 研究文档里单列：
  - coworker schema
  - inheritance strategy
  - tool restriction mapping
  - memory / skill preload strategy

## 10. Plugins 与文件系统设置

### 10.1 Plugins

官方插件文档说明 Agent SDK 可以 programmatically 加载本地插件目录，为会话注入：

- skills
- agents
- hooks
- MCP servers

来源：

- Plugins: https://platform.claude.com/docs/en/agent-sdk/plugins

### 10.2 Filesystem settings

Overview 和 TypeScript 文档明确：

- SDK 支持 Claude Code 的文件系统配置
- 但 TypeScript 默认不加载这些设置
- 要显式传 `settingSources: ['project']` 才会加载 `CLAUDE.md`、skills、hooks 等项目级内容

来源：

- Overview: https://platform.claude.com/docs/en/agent-sdk/overview
- TypeScript Reference: https://platform.claude.com/docs/en/agent-sdk/typescript
- Migration Guide: https://platform.claude.com/docs/en/agent-sdk/migration-guide

对 AgentSuit 的含义：

- 不能假设“只要 cwd 对了，Claude 就会自动吃到 `CLAUDE.md`”
- 如果我们要让 Suit 映射到 filesystem-based Claude features，需要明确决定是否开启 `settingSources`
- 当前更稳妥的 MVP 路线仍然是：
  - 用 `systemPrompt.append` 注入 Suit overlays
  - 不默认依赖 `.claude/*` 文件副作用

## 11. Hosting 与容器部署

官方 Hosting 文档有几个对我们很关键的点：

- SDK 应跑在容器沙箱里
- 需要 Node.js 18+
- 还需要 Claude Code CLI
- 推荐容器内暴露 HTTP / WebSocket 端点与外部通信
- 推荐根据场景选择：
  - 临时会话
  - 长时间运行会话
  - 混合会话
  - 单容器多 agent

来源：

- Hosting: https://platform.claude.com/docs/en/agent-sdk/hosting

对 AgentSuit 的含义：

- 我们现在的单机 Docker runtime 是对路的
- 但如果后续要完全对齐官方 hosting 建议，还应补齐：
  - 更明确的容器隔离策略
  - 空闲回收策略
  - 容器内 Claude Code CLI 生命周期管理
  - 外层 HTTP/WebSocket/chat 网关

这里还有一个重要点：

> 官方文档把 “Node.js（TypeScript SDK）” 和 “Claude Code CLI” 分开列为系统要求。

但这里存在一个官方文档层面的口径差异：

- Agent loop 文档说 SDK 是 standalone package，“You don't need the Claude Code CLI installed to use it”
- Hosting 文档又把 `Claude Code CLI` 列为系统依赖，并给出 `npm install -g @anthropic-ai/claude-code`

来源：

- Agent loop: https://platform.claude.com/docs/en/agent-sdk/agent-loop
- Hosting: https://platform.claude.com/docs/en/agent-sdk/hosting

我的判断是：

- 从“编程接口语义”上，SDK 对应用开发者表现为 standalone package
- 从“生产托管与系统依赖”视角，Anthropic 仍然把 Claude Code runtime/CLI 视为底层运行时依赖的一部分

对 AgentSuit 来说，比较稳妥的工程假设仍然是：

- 不把它当成普通纯 HTTP SDK
- 容器镜像与部署文档层面，继续按“Claude runtime 依赖”来设计
- adapter 接口层则继续把它当作 programmatic SDK 使用

## 12. 迁移指南的关键影响

官方迁移指南明确：

- Claude Code SDK 已更名为 Claude Agent SDK
- TypeScript 主要迁移动作是替换包名与 import
- 新 SDK 不再默认加载 Claude Code system prompt
- 新 SDK 不再默认加载 filesystem settings

来源：

- Migration Guide: https://platform.claude.com/docs/en/agent-sdk/migration-guide

对 AgentSuit 的直接影响：

1. 文档命名上应尽量写 “Claude Agent SDK”
2. 产品层仍可保留 `claude-code adapter` 这个 runtime 名称
3. 代码里必须显式处理：
   - `systemPrompt`
   - `settingSources`

## 13. 对当前仓库的判断

结合当前代码库，我的判断是：

### 13.1 我们当前实现方向是正确的

当前 `adapter-claude-code` 走的是：

- `@anthropic-ai/claude-agent-sdk`
- stable `query()`
- `systemPrompt` 注入 Suit overlays
- `cwd` 映射
- runtime 传入 `mcpServers`
- 将 Claude 消息流归一化为 AgentSuit runtime events

这条主线没有偏。

### 13.2 但现在仍是 MVP，不是完整 Agent SDK 集成

当前还缺：

- streaming input mode 主路径
- `continue` / `resume` / `fork`
- `includePartialMessages`
- `canUseTool` 审批桥接
- hooks 注入
- `settingSources`
- plugins / skills / agents 的 programmatic 加载
- 更完整的 `result/error_*` 映射

### 13.3 `plugin-chat / Vercel Chat SDK` 应该怎么接

建议方向：

1. chat 插件对接 runtime session，而不是直接依赖 Claude SDK
2. 但 runtime 的 Claude adapter 后端应升级为 streaming input mode
3. chat UI 必须能渲染三类事件：
   - assistant text
   - tool / approval / question
   - session lifecycle
4. `canUseTool` 与 `AskUserQuestion` 建议映射到统一的 plugin event contract

### 13.4 当前仓库已有一条真实可用链路

结合本次仓库验证，当前我们已经在本地和 Docker 容器里跑通：

- `@anthropic-ai/claude-agent-sdk`
- `claude-code` adapter
- `.env` 注入
- 真实消息返回

这说明至少在当前工程上下文里，Agent SDK 已经可以作为实际可运行基础，而不是纸面调研结论。

## 14. 建议的后续工作

### 14.1 适配层

- 将 `adapter-claude-code` 从 one-shot `sendInput()` 演进到 streaming input mode
- 增加 `continue/resume` 能力
- 增加 partial message streaming 支持

### 14.2 注入层

- 研究 `settingSources` 是否启用
- 研究 hooks 注入方案
- 研究 plugins / skills / subagents 的 programmatic 装配

### 14.3 插件层

- `plugin-chat` 设计审批与提问事件
- Vercel Chat SDK transport 以 runtime event stream 为主，而不是直接耦合 Claude SDK
- A2UI 用于承接 `AskUserQuestion` 与审批 UI

### 14.4 部署层

- 补容器内 Claude Code CLI/runtime 管理说明
- 补长会话与混合会话的容器策略
- 补监控、空闲超时和状态恢复设计

## 15. 最终判断

Claude Agent SDK 很适合作为 AgentSuit 的 Claude 适配基础，但需要明确：

- 它是 Claude Code runtime 的程序化封装，不是普通 LLM SDK
- 它天然更适合“长生命周期 agent session”，而不是“无状态聊天接口”
- 容器托管、权限、hooks、MCP、subagents、plugins 才是它的真正价值面
- 对 AgentSuit 来说，最合理的架构不是“所有能力都塞进 adapter”，而是：

```text
AgentSuit Runtime
  -> claude-code adapter
    -> Claude Agent SDK / Claude Code runtime
      -> native tools / MCP / permissions / hooks / sessions

AgentSuit Plugins / Providers
  -> chat/web exposure
  -> memory provider
  -> A2A / A2UI bridge
  -> audit / policy / approval UI
```

这是目前最符合官方文档、也最符合本仓库产品方向的落地方式。

## 参考链接

- Overview: https://platform.claude.com/docs/en/agent-sdk/overview
- TypeScript SDK Reference: https://platform.claude.com/docs/en/agent-sdk/typescript
- Sessions: https://platform.claude.com/docs/en/agent-sdk/sessions
- Streaming Input: https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
- Streaming Output: https://platform.claude.com/docs/en/agent-sdk/streaming-output
- Permissions: https://platform.claude.com/docs/en/agent-sdk/permissions
- User Input: https://platform.claude.com/docs/en/agent-sdk/user-input
- Hooks: https://platform.claude.com/docs/en/agent-sdk/hooks
- Agent Loop: https://platform.claude.com/docs/en/agent-sdk/agent-loop
- MCP: https://platform.claude.com/docs/en/agent-sdk/mcp
- Subagents: https://platform.claude.com/docs/en/agent-sdk/subagents
- Plugins: https://platform.claude.com/docs/en/agent-sdk/plugins
- Hosting: https://platform.claude.com/docs/en/agent-sdk/hosting
- Migration Guide: https://platform.claude.com/docs/en/agent-sdk/migration-guide
