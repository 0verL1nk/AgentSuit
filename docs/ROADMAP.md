# AgentSuit Roadmap

## 1. 目标

这份路线图只关注一条主线：

先把 AgentSuit 做成一个真正可用的 MVP，能够部署到云端，基于 `Claude Code` 作为首个 `base agent`，并通过 `Vercel Chat SDK` 提供第一个可交互的 chat 入口。

这意味着我们先不追求：

- 同时支持多个 base agent
- 完整的跨 runtime capability 覆盖
- 多租户控制面
- Kubernetes-first 架构
- 完整 plugin marketplace
- 复杂 memory / RAG / A2A / A2UI

第一阶段只要证明这条链路成立即可：

`Suit -> Runtime Host -> Claude Code Adapter -> Session API -> Chat Gateway -> Cloud Deployment`

---

## 2. 当前基线

基于当前仓库，已经具备的内容主要是本地 Suit 工作流基础：

- `suit new`
- `suit validate`
- `suit inspect`
- `suit pack`
- 基础 manifest/schema
- 初始 monorepo 包结构

当前还没有真正实现的关键部分：

- `extract`
- `apply`
- `serve`
- `runtime host`
- `Claude Code adapter`
- `chat/web plugin`
- 云端部署镜像与启动流程

因此最现实的策略不是全面铺开，而是围绕 MVP 单线推进。

---

## 3. MVP 定义

### 3.1 MVP 目标

MVP 只要求达成以下能力：

1. 能读取一个本地 Suit。
2. 能启动一个单实例 `Agent Service Runtime`。
3. 能接入 `Claude Code` 作为首个 base agent。
4. 能通过统一 `Session API` 与 agent 交互。
5. 能通过 `Vercel Chat SDK` 暴露一个 chat 入口。
6. 能以 Docker 镜像方式部署到云端单机环境。
7. 有最基本的 health check、日志和启动报告。

### 3.2 MVP 不包含

- `Codex` adapter
- `OpenClaw` adapter
- 通用 web console
- A2A / A2UI
- plugin marketplace
- native memory provider matrix
- 完整 registry / publish / pull 云端闭环
- 多实例调度和多租户隔离

---

## 4. 产品形态

### 4.1 首发形态

首发以一个单容器服务运行：

- 一个 Docker 容器
- 一个 `AgentServiceInstance`
- 一个 `Claude Code` base agent adapter
- 一个或多个 Suit
  - MVP 先只要求单 Suit
- 一个 chat 暴露层
  - 基于 `Vercel Chat SDK`

### 4.2 首发部署环境

优先支持：

- 单机云主机
- 单容器 Docker 部署
- 反向代理可选
- Redis / DB 可选，不作为 MVP 强依赖

推荐先覆盖：

- `docker run`
- Fly.io / Railway / Render / 单机 VM

不要求第一天就做 Kubernetes。

---

## 5. 路线图

## Phase 0: 收紧核心契约

目标：在写 runtime 和 adapter 之前，把最容易返工的公共边界先定住。

交付物：

- `@agentsuit/schema`
  - 扩展 manifest，纳入 `service`、`skills`、`tools`、`memory`、`policy` 基本结构
- `@agentsuit/adapter-api`
  - 定义 `detect / inspectCapabilities / buildApplyPlan / executeApplyPlan`
- `@agentsuit/plugin-api`
  - 定义 `ExposurePlugin`
- `@agentsuit/runtime`
  - 定义 `SessionApi`、`AgentEvent`、`ServeReport`

完成标准：

- 公共类型和接口单独成包
- 包导出通过 `exports` 收口
- contract tests 跑通

为什么先做这一段：

- 如果没有稳定契约，后面 `Claude Code adapter` 和 `chat gateway` 很容易把 runtime 设计带偏

---

## Phase 1: 本地 Runtime MVP

目标：在本地先跑通服务态，不先碰云部署复杂度。

交付物：

- `suit serve <path>`
- 单实例 runtime host
- 本地文件状态目录
- 健康检查端点
- 最基础的 session 生命周期
- `serve-report.json`

完成标准：

- 能读取一个 Suit
- 能启动 runtime host
- 能创建 session
- 能流式返回事件
- 服务失败时有明确错误和报告

这一阶段先不接 chat UI，只验证内核。

---

## Phase 2: Claude Code Adapter MVP

目标：接入第一个真实可用的 base agent。

交付物：

- `packages/adapter-claude-code`
- Claude Code 环境探测
- instructions / prompt overlay 注入
- MCP/tool 基础映射
- subagent/coworker 的最小可行映射
- approvals / sandbox 基础映射

MVP 范围内建议只做这些能力：

- `prompt / identity`
- `tools / MCP`
- `policy`
- `session stream`

可以明确延后：

- 完整 hooks 生成
- 复杂 coworker handoff
- Claude native memory 的深度映射

完成标准：

- 在受支持环境中探测到 Claude Code
- 能把 Suit 的最小能力注入 Claude Code
- 能通过 Session API 与 Claude Code 往返

---

## Phase 3: Chat Gateway MVP

目标：先给用户一个真正可交互入口，而不是只停在 CLI。

交付物：

- `packages/plugin-chat`
- 适配 `Vercel Chat SDK`
- chat thread -> Session API 映射
- streaming response -> chat stream 映射
- 基础状态存储

为什么选这个方向：

- `chat` npm 包现在是 Vercel 官方公开 beta，目标就是“一套代码接多个聊天平台”
- 它是事件驱动架构，并且支持可插拔 state adapter
- 其 `post()` 能直接接受 AI SDK text stream，适合承接 runtime 的流式输出

对 MVP 的意义：

- AgentSuit 不需要一开始就做完整 web 前端
- 可以先把“会话、事件流、云部署、平台对接”这条链路打通

MVP 完成标准：

- 用户能通过 chat 入口发消息
- runtime 能创建对应 session
- Claude Code adapter 能返回流式结果
- chat 侧能正确展示和结束一次对话

### 5.3.1 可直接借鉴 NanoClaw 的地方

可以参考 `qwibitai/nanoclaw`，但不要直接复制它的“多 IM + SQLite + polling loop + container IPC”整套实现。

真正值得借鉴的是它的桥接模式：

1. `channel layer` 和 `agent runtime` 分离
- NanoClaw 用 `channels/registry.ts` 做 channel 注册，再由主编排器决定怎么把消息送进 agent
- 对 AgentSuit，这一层应由 `plugin-chat` 承担，底层可以换成 `Vercel Chat SDK`

2. `chat thread -> Claude session` 映射
- NanoClaw 持久化 session id，并把同一 group/thread 的后续消息继续送入同一 Claude 会话
- AgentSuit 也应该做同样的映射：
  - 一个 chat thread
  - 对应一个 runtime session
  - 对应一个 Claude Code session id

3. `每个会话串行化`
- NanoClaw 用 per-group queue 避免同一组消息并发打进同一个 Claude 会话
- AgentSuit 也应该至少保证：
  - 同一 thread/session 内串行处理
  - 不允许多个并发输入同时写入同一个 Claude session

4. `流式输出桥`
- NanoClaw 的 container runner 持续接 Claude 输出，再逐步回推到消息渠道
- AgentSuit 对应地应实现：
  - Claude Code stream/events
  - 转成 Session API events
  - 再转成 `Vercel Chat SDK` 可消费的流

5. `runtime 隔离优先`
- NanoClaw 很强调把 Claude 运行环境和消息系统分层，避免 channel 代码直接碰 runtime 内部
- AgentSuit 也应坚持：
  - `plugin-chat` 只碰 Session API
  - `adapter-claude-code` 只碰 Claude runtime
  - 两边不要互相知道内部实现

### 5.3.2 不建议照搬 NanoClaw 的地方

这些点只适合作为参考，不适合原样照搬：

- 多 IM 平台注册表
- polling loop 驱动的消息摄取
- 以 SQLite 为中心的消息总线
- 文件 IPC 作为长期主协议
- 每个群一套文件夹和 `.claude` 目录的产品模型

原因：

- NanoClaw 是“Claude Code 驱动的多渠道个人助手”
- AgentSuit 的 MVP 是“云端单实例 agent service + chat gateway”
- 我们的暴露层会以 `Vercel Chat SDK` 为主，而不是自己维护一组 IM channel adapters

### 5.3.3 对 AgentSuit 的具体实现建议

基于 NanoClaw 的经验，但按 AgentSuit 的目标做收敛，建议 `plugin-chat` 采用如下结构：

```text
Vercel Chat SDK thread
  -> plugin-chat
  -> Session API
  -> Claude Code adapter
  -> Claude session
  -> Agent events
  -> plugin-chat stream bridge
  -> Vercel Chat SDK thread.post(...)
```

必须先实现的最小能力：

- thread/session id 映射表
- per-thread 串行队列
- 流式输出桥
- 中断与结束态处理
- 启动失败与超时上报

可以延后：

- 多渠道统一 inbox
- 复杂调度
- group memory / per-group filesystem
- scheduled tasks

---

## Phase 4: Cloud Deployment MVP

目标：让它不只是本地能跑，而是真能部署到云端。

交付物：

- runtime Dockerfile
- 容器启动脚本
- 环境变量规范
- 健康检查
- 最小云部署文档

建议容器职责：

- 启动 runtime host
- 加载 Suit
- 初始化 Claude Code adapter
- 启动 chat plugin
- 暴露：
  - chat port
  - admin/health port

完成标准：

- 本地 `docker run` 可用
- 云端单机部署可用
- 至少有一个 smoke test 覆盖容器启动和基本会话往返

---

## Phase 5: MVP 打磨

目标：把能演示的东西提升到能试用。

交付物：

- 更清晰的日志和报告
- session / instance 基础审计
- 配置文件规范
- 最基础错误码
- 简单认证或访问控制
- Docker 运行样例

完成标准：

- Demo 可重复部署
- 故障时能定位在 adapter、runtime、plugin 哪一层
- 文档足够让外部开发者跑起来

---

## 6. 建议的实现优先级

严格建议按这个顺序做：

1. `schema / runtime / adapter-api / plugin-api`
2. `suit serve`
3. `runtime host`
4. `adapter-claude-code`
5. `plugin-chat`
6. `docker deploy`

不要先做：

- Codex adapter
- OpenClaw adapter
- A2A / A2UI
- memory provider 全家桶
- plugin marketplace

原因很简单：

- 这些都会放大问题空间
- 但并不能更快证明 MVP 是否成立

---

## 7. 风险与约束

### 7.1 Claude Code Adapter 风险

风险：

- 注入点虽然多，但真正稳定可依赖的映射边界需要保守选择
- hooks 和更强自动化能力可能引入安全风险

应对：

- MVP 先只支持最小注入面
- 先不把复杂 hook 自动化纳入 MVP

### 7.2 Chat Gateway 风险

风险：

- `chat` 当前是公开 beta，接口可能继续演进

应对：

- AgentSuit 不直接把 chat SDK 当核心契约
- 通过 `plugin-chat` 做隔离层

### 7.3 云部署风险

风险：

- Claude Code 的运行环境、认证、依赖和容器行为需要额外验证

应对：

- 云部署先做单机 Docker MVP
- 先把“可部署”定义为单容器、单实例、单入口

---

## 8. 里程碑验收标准

### Milestone A

“AgentSuit runtime 内核 ready”

标准：

- `suit serve` 存在
- runtime host 可运行
- session 生命周期跑通

### Milestone B

“Claude Code adapter 接通”

标准：

- Suit 最小注入面接通
- Session API 可与 Claude Code 往返

### Milestone C

“Chat 入口接通”

标准：

- 通过 chat 入口可完成一次真实会话
- 支持流式结果展示

### Milestone D

“云端 MVP ready”

标准：

- Docker 镜像可部署
- 健康检查可用
- 最小 demo 可跑通

---

## 9. MVP 之后再做什么

MVP 验证通过后，再扩：

- `Codex` adapter
- `OpenClaw` adapter
- `plugin-web`
- memory providers
- A2A / A2UI
- registry 与分发闭环
- 多实例与多租户

顺序建议：

1. Codex adapter
2. memory provider
3. web plugin
4. OpenClaw deeper integration
5. A2A / A2UI

---

## 10. 参考依据

路线图中的两个关键外部依赖方向，基于以下官方资料判断：

- Claude Code 官方文档显示其已有明确的 memory、MCP、subagents、hooks、settings 能力，适合作为首个 adapter
  - https://code.claude.com/docs/en/memory
  - https://code.claude.com/docs/en/mcp
  - https://code.claude.com/docs/en/sub-agents

- Vercel AI SDK 官方文档显示其已是统一 TypeScript AI toolkit，适合接模型与流式输出
  - https://vercel.com/docs/ai-sdk

- `chat` SDK 官方 changelog 显示其当前公开 beta，定位是一套代码连接多种 chat 平台，并支持 pluggable state adapters 与流式输出
  - https://vercel.com/changelog/chat-sdk

因此当前最务实的 MVP 路线是：

`Claude Code adapter + AgentSuit runtime + plugin-chat(Vercel Chat SDK) + Docker cloud deploy`
