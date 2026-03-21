# AgentSuit Adapter 适配调研

## 1. 目的

本文档聚焦 AgentSuit 的 `adapter` 设计，研究当前三类目标 runtime / base agent 的真实适配面：

- Claude Code
- Codex
- OpenClaw

目标不是立即实现 adapter，而是先回答这些关键问题：

1. 哪些能力是 runtime 原生支持，适合直接映射？
2. 哪些能力只支持近似映射，需要 `degraded`？
3. 哪些能力不应强塞进 runtime，而应由 AgentSuit 自己提供 `plugin-backed` 能力？
4. Adapter 的边界应放在哪里，避免后续因为 runtime 差异把 `core` 污染掉？

本文档基于 2026-03-21 可访问的官方文档与官方仓库资料整理。凡是我没有在官方资料里找到明确证据的点，都会标成“未见官方明确说明”。

---

## 2. 结论先行

### 2.1 Adapter 不应只是“按 runtime 分目录”

如果只按 `adapter-claude-code`、`adapter-codex`、`adapter-openclaw` 粗粒度拆包，后期会越来越难维护。更合理的设计是两层：

1. `Runtime Adapter`
负责 runtime-specific 的读写与生命周期接入：
- instructions / settings / config 写入
- base agent 启动与会话接入
- 事件流与权限模型读取
- subagent / session / sandbox / approval 适配

2. `Capability Provider`
负责能力本身的补位：
- memory provider
- tool provider
- skill provider
- policy provider
- telemetry / audit provider

换句话说：

> Adapter 负责“接到哪儿”，Provider 负责“怎么实现这项能力”。

### 2.2 `memory` 不应该假设由 base agent 原生提供

这是这次调研最重要的结论之一。

- Claude Code 有明确的 `CLAUDE.md + auto memory + subagent memory` 体系
- OpenClaw 有明确的 memory 工具组与 memory plugin 槽位
- Codex 我没有找到与 Claude Code 类似的一等持久 memory 模块文档；它有 `AGENTS.md`、skills、history、SQLite state、subagents、MCP，但未见官方把“跨会话记忆”定义成独立原生能力

因此：

> AgentSuit 不应把 memory 设计为“adapter 可选字段”，而应把它设计成独立 capability，并允许 `native` 或 `plugin-backed` 两种实现。

### 2.3 Claude Code 当前最适合做第一优先 adapter

原因：

- instructions / memory / rules / hooks / subagents / MCP / plugin 都有明确官方文档
- 作用域和配置层次清晰
- 可以较自然地把 Suit 的 prompt、skills、tools、subagents、memory 映射进去

### 2.4 Codex 很强，但它更像“instructions + skills + MCP + sandbox + subagents”的 harness

从官方资料看，Codex 原生强项在：

- `AGENTS.md` / `model_instructions_file`
- `skills`
- MCP
- sandbox / approvals
- subagents
- project-scoped config / trusted project

但对于“类似 Claude auto memory 的持久记忆层”，文档里没有看到同等级的官方概念。对 AgentSuit 来说，这更适合走：

- `instructions`: native
- `skills`: native
- `tools / MCP`: native
- `memory`: plugin-backed
- `policy`: native + degraded

### 2.5 OpenClaw 反而最接近“AgentSuit 理想形态”

OpenClaw 原生就有：

- injected bootstrap files
- skills
- built-in tools
- subagents
- memory 工具和 memory plugin 槽位
- ACP session/runtime 桥接

这意味着它既能作为“提取源”，也很适合作为“能力对照组”，帮助 AgentSuit 定义 canonical capability model。

---

## 3. 调研方法

本次主要参考：

- Claude Code 官方文档
- OpenAI Codex 官方文档与 OpenAI 官方工程文章
- OpenAI `openai/codex` 官方仓库文档
- OpenClaw 官方文档

优先级：

1. 官方产品文档
2. 官方工程说明
3. 官方开源仓库文档
4. 其他来源仅作补充，不作为主结论依据

---

## 4. Claude Code 调研结论

### 4.1 Instructions / Prompt 注入

Claude Code 对“长期指令”支持很明确：

- `CLAUDE.md` 是持久 instructions 入口
- 支持多层级加载
- 支持 `.claude/rules/`
- 支持排除特定 `CLAUDE.md`

官方文档明确说，每个 session 都会加载两类持久知识：

- `CLAUDE.md files`
- `Auto memory`

来源：

- Claude Code memory docs: [How Claude remembers your project](https://code.claude.com/docs/en/memory)

这意味着 Suit 的 `prompt overlays`、`identity`、`policy hints` 都可以优先映射到：

- `CLAUDE.md`
- `.claude/rules/*.md`
- 必要时的 subagent prompt

### 4.2 Memory

Claude Code 的 memory 能力是目前三者中最成熟、最明确的：

- `CLAUDE.md` 作为人为维护的长期 instructions
- `auto memory` 作为 Claude 自己累积的 learnings
- subagent 还可启用独立 persistent memory

官方文档说明：

- 每个 session 是新上下文，但会加载 `CLAUDE.md` 和 auto memory
- auto memory 默认开启
- 项目 memory 目录在 `~/.claude/projects/<project>/memory/`
- subagent 的 `memory` 字段可以声明 `user / project / local`

来源：

- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)

对 AgentSuit 的含义：

- `memory.sources` 可优先走 native mapping
- Suit 可以把“共享记忆”和“subagent-specific memory”分别映射
- 仍然建议保留 `plugin-backed memory` 兜底，因为 Claude 的 memory 语义不一定等于 AgentSuit 想要的 memory contract

### 4.3 Skills

Claude Code 有两层相关能力：

1. `subagents`
2. `plugins`

官方文档明确写到，Claude Code 的插件系统可以扩展：

- skills
- agents
- hooks
- MCP servers

来源：

- [Claude Code settings](https://code.claude.com/docs/en/settings)

这说明 Suit 的 `skills.entries` 不应该只映射为静态 markdown 文件，而要区分：

- 直接注入到主会话的 workflow / rules
- preload 到 subagent 的 skills
- 作为 plugin distribution 的共享能力

### 4.4 Tools / MCP

Claude Code 对 MCP 的支持很强：

- 支持用户级、项目级、local 级配置
- 支持 `.mcp.json`
- 支持环境变量展开
- 支持 HTTP MCP 和 stdio MCP
- subagent 还能声明额外 `mcpServers`

来源：

- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)

这意味着 Suit 的 `tools.declarations` 可以优先走：

- native MCP server mapping
- native tool permission restriction
- subagent-scoped MCP

### 4.5 Subagents / Coworkers

Claude Code 的 subagent 模型也很适合映射 Suit 的 `coworkers`：

- 每个 subagent 有独立 context window
- 自定义 system prompt
- 独立 tool access
- 独立 permissions
- 可 preload skills
- 可启用 persistent memory

来源：

- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)

因此：

- `coworkers.agents` 对 Claude Code 不是弱映射，反而接近 native
- Suit 的 `handoff` 仍需谨慎，只能映射到 Claude 明确支持的 delegation / explicit invoke / session-wide agent 模式

### 4.6 Policy / Hooks / Governance

Claude Code 提供了丰富的 hook 事件：

- `SessionStart`
- `PreToolUse`
- `PermissionRequest`
- `SubagentStart`
- `SubagentStop`
- `InstructionsLoaded`
- `SessionEnd`

来源：

- [Hooks reference](https://code.claude.com/docs/en/hooks)

对 AgentSuit 的含义：

- 一部分 `policy` 可以原生映射为 hook + settings
- 一部分审计与守卫逻辑可以由 AgentSuit 生成 hook 脚本
- 但安全风险也更大，因为 hooks 本质上是自动执行 shell 命令

### 4.7 Claude Code 适配判断

#### 适合 native 的能力

- instructions / prompt overlays
- project memory / auto memory 对接
- MCP tools
- subagents / coworkers
- hooks / permission restrictions
- plugin-based distribution

#### 适合 plugin-backed 的能力

- AgentSuit 自定义 memory contract
- 统一 telemetry / audit
- 跨 runtime 一致的 capability report

#### 风险点

- Claude 的 native memory 与 AgentSuit memory contract 不完全同义
- hooks 很强，但也可能引入危险自动化
- plugin marketplace / settings scope 会带来更多治理复杂度

---

## 5. Codex 调研结论

### 5.1 Instructions / Prompt 注入

Codex 的 instructions 入口非常明确：

- `AGENTS.md`
- `AGENTS.override.md`
- `model_instructions_file`
- `project_doc_fallback_filenames`

OpenAI 官方工程文章还明确说明了 Codex 在构造输入时会纳入：

- `$CODEX_HOME` 下的 `AGENTS.override.md` 和 `AGENTS.md`
- 从项目根到 cwd 路径上的 `AGENTS.override.md` / `AGENTS.md`
- 已配置的 skills

来源：

- [Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)
- [Config basics](https://developers.openai.com/codex/config-basic)
- [Configuration reference](https://developers.openai.com/codex/config-reference)

对 AgentSuit 的含义：

- `prompt.overlays` 很适合映射到 `AGENTS.md` 或 `model_instructions_file`
- `identity` 和 project rules 也可映射
- 但要注意 Codex 的 instruction 体系偏“AGENTS / config driven”，而不是像 Claude 那样有独立 memory / rule 双系统

### 5.2 Skills

Codex 已经把 skills 作为一等能力暴露出来：

- skill 是一个包含 `SKILL.md` 的目录
- 可附带 `scripts/`、`references/`、`assets/`、`agents/`
- `config.toml` 中可通过 `skills.config` 配置 skill 路径和开关

来源：

- [Agent Skills](https://developers.openai.com/codex/skills)
- [Configuration reference](https://developers.openai.com/codex/config-reference)

因此 Suit 的 `skills.entries` 对 Codex 是 native-friendly 的。

### 5.3 Tools / MCP

Codex 的 MCP 支持也很强：

- CLI 与 IDE Extension 共享同一配置
- 支持用户级 `~/.codex/config.toml`
- 支持 trusted project 下的 `.codex/config.toml`
- 支持 stdio MCP
- 支持 streamable HTTP MCP
- 支持 bearer token、OAuth、enabled_tools / disabled_tools、timeout、required 等控制项

来源：

- [Model Context Protocol – Codex](https://developers.openai.com/codex/mcp)
- [Configuration reference](https://developers.openai.com/codex/config-reference)

因此 Suit 的 `tools.declarations` 对 Codex 也可以优先走 native MCP。

### 5.4 Subagents / Multi-agent

Codex 现在原生支持 subagents：

- 显式要求时可 spawn specialized agents
- 可并行运行
- 会汇总结果返回
- subagents 继承当前 sandbox policy

来源：

- [Subagents – Codex](https://developers.openai.com/codex/subagents)

因此 Suit 的 `coworkers` 在 Codex 上不应默认判为 blocked，而应优先尝试：

- native subagent mapping
- 若 handoff 语义不完全匹配，则 degraded

### 5.5 Policy / Sandbox / Approvals

Codex 对 sandbox 和 approval 有完整配置体系：

- `approval_policy`
- granular approval
- `sandbox_mode = read-only | workspace-write | danger-full-access`
- workspace-write 可额外控制 `network_access` 和 `writable_roots`

来源：

- [Advanced configuration](https://developers.openai.com/codex/config-advanced)
- [Configuration reference](https://developers.openai.com/codex/config-reference)

对 AgentSuit 的意义：

- `policy.approvals` 与 `policy.safety` 可以有较强 native mapping
- 但要注意 MCP 工具本身不受 shell sandbox 直接保护，这一点 OpenAI 工程文章讲得很明确

来源：

- [Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)

### 5.6 Memory

这是 Codex 最值得小心的点。

我在本次查到的官方资料里看到了这些相关能力：

- `AGENTS.md`
- skills
- session history persistence
- SQLite-backed state DB
- subagents

但没有看到一个与 Claude Code `auto memory` 或 OpenClaw `memory plugin slot` 对等的一等“persistent memory subsystem”官方描述。

这不是说 Codex 做不到 memory，而是说明：

> 以当前可见官方资料判断，Codex 的 memory 更适合作为 AgentSuit 的 `plugin-backed capability` 来设计，而不是假定为 native capability。

更稳妥的适配策略：

- 基础长期指令走 `AGENTS.md`
- 结构化长期记忆走 `Suit Memory Provider`
- 若需要让 Codex 使用该记忆，则通过：
  - MCP memory server
  - skill + prompt conventions
  - 受控的 file-backed memory

### 5.7 Codex 适配判断

#### 适合 native 的能力

- instructions
- skills
- MCP tools
- subagents
- approvals / sandbox

#### 更适合 plugin-backed 的能力

- persistent memory
- cross-runtime consistent policy explanation
- unified telemetry / audit

#### 风险点

- MCP 是强入口，但其安全边界不等于 shell sandbox
- project config 受 trusted project 约束
- memory 语义需要 AgentSuit 自己补一层，不宜假设 Codex 原生覆盖

---

## 6. OpenClaw 调研结论

### 6.1 Instructions / Persona / Bootstrap

OpenClaw 的 Agent Runtime 明确有 injected bootstrap files：

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `BOOTSTRAP.md`
- `IDENTITY.md`
- `USER.md`

来源：

- [Agent Runtime | OpenClaw](https://openclaw.im/docs/concepts/agent)

这说明 OpenClaw 天然适合承接 Suit 里这些结构化能力：

- identity
- prompt
- tool notes
- user profile
- bootstrap/init ritual

### 6.2 Skills

OpenClaw 的 skill 目录层次也比较清晰：

- bundled
- `~/.openclaw/skills`
- `<workspace>/skills`

来源：

- [Agent Runtime | OpenClaw](https://openclaw.im/docs/concepts/agent)

因此 Suit 的 skills 对 OpenClaw 也是原生友好的。

### 6.3 Tools

OpenClaw 文档直接列出了 built-in tool groups：

- runtime
- fs
- sessions
- memory
- web
- ui
- automation
- messaging
- nodes

其中 memory 组明确包含：

- `memory_search`
- `memory_get`

来源：

- [Tools and Plugins | OpenClaw](https://docs.openclaw.ai/tools)

### 6.4 Memory

OpenClaw 这块比 Codex 更强，也更接近 AgentSuit 的设计方向：

- `AGENTS.md` 自身就被描述成 operating instructions + “memory”
- 有 native memory 工具组
- 有 memory plugin slot
- 官方插件里有：
  - `memory-core`
  - `memory-lancedb`

来源：

- [Agent Runtime | OpenClaw](https://openclaw.im/docs/concepts/agent)
- [Plugins | OpenClaw](https://docs.openclaw.ai/tools/plugin)

因此 OpenClaw 对 AgentSuit 的启发很大：

> memory 完全可以被设计成 slot / provider，而不是硬编码成 runtime 固有模块。

### 6.5 Subagents / ACP

OpenClaw 的 subagent 设计有两个点对 AgentSuit 很重要：

1. 原生支持 subagents / sessions_spawn
2. 明确支持 `runtime: "acp"` 的 harness sessions，文档直接点名：
   - Codex
   - Claude Code
   - Gemini CLI

来源：

- [Sub-Agents | OpenClaw](https://docs.openclaw.ai/tools/subagents)

这意味着：

- OpenClaw 不只是 target runtime
- 它还可以作为 AgentSuit 的“编排对照组”或桥接参考
- 未来如果 AgentSuit 也做多 agent / remote session 编排，OpenClaw 的 ACP 接入思路很值得研究

### 6.6 Plugin 生态

OpenClaw 的插件文档已经展示了 slot-based 思路，尤其是 memory slot：

- `plugins.slots.memory = "memory-lancedb"`

来源：

- [Plugins | OpenClaw](https://docs.openclaw.ai/tools/plugin)

这和 AgentSuit 想要的 provider / plugin-based capability 非常契合。

### 6.7 OpenClaw 适配判断

#### 适合 native 的能力

- instructions / persona / bootstrap
- skills
- tools
- memory
- subagents

#### 适合借鉴其设计的能力

- plugin slots
- capability providers
- ACP bridge / session runtime

#### 风险点

- OpenClaw 的 runtime 语义更“厚”，直接镜像到其他 runtime 会有大量语义缺口
- 适合作为 canonical model 参考，但不适合把其模型直接当成全局标准

---

## 7. 三者对比矩阵

| 能力 | Claude Code | Codex | OpenClaw | AgentSuit 建议 |
|---|---|---|---|---|
| Instructions / Persona | 强 native | 强 native | 强 native | 统一 canonical prompt/identity，分别映射 |
| Skills / Workflow | 强 native | 强 native | 强 native | 作为一等 capability |
| MCP / Tools | 强 native | 强 native | 原生 tool + plugin | 统一 tool contract |
| Persistent memory | 强 native | 未见同等级原生能力 | 强 native | 不要绑死到 runtime，做 provider |
| Subagents / Coworkers | 强 native | 强 native | 强 native | coworkers 可作为一等 capability |
| Hooks / Policy | 强 native | 强 native | 有工具/策略层 | policy 拆为 native + provider |
| Plugin ecosystem | 明确存在 | 已有 skills / MCP / app / config-based extensibility | 明确存在 | AgentSuit 自己也要 plugin-first |
| Capability slot 思维 | 中等 | 中等 | 很强 | 借鉴 OpenClaw |

说明：

- 对 Codex 的 “Persistent memory = 未见同等级原生能力” 是基于本次官方资料检索的保守判断，不等于未来不会出现，也不等于社区没有实现。

---

## 8. 对 AgentSuit Adapter 架构的建议

### 8.1 统一 capability 状态机

建议 adapter 返回统一能力状态：

- `native`
- `degraded`
- `plugin-backed`
- `blocked`

不要只用 `supported / unsupported`。

原因：

- `memory`、`coworker handoff`、`policy guardrails` 经常不是二元问题
- 很多能力可以补位，但不应伪装成 runtime 原生支持

### 8.2 Adapter 接口建议

建议将 `Runtime Adapter` 的职责限定为：

```ts
export interface RuntimeAdapter {
  name: string;
  detect(target: AdapterTarget): Promise<RuntimeDiscovery>;
  inspectCapabilities(target: AdapterTarget): Promise<RuntimeCapabilityProfile>;
  buildApplyPlan(input: NormalizedSuitModel, target: AdapterTarget): Promise<ApplyPlan>;
  executeApplyPlan(plan: ApplyPlan): Promise<ApplyResult>;
}
```

同时引入独立 provider：

```ts
export interface MemoryProvider { /* ... */ }
export interface ToolProvider { /* ... */ }
export interface SkillProvider { /* ... */ }
export interface PolicyProvider { /* ... */ }
```

### 8.3 `memory` 的推荐建模

建议直接定义三层：

1. `MemoryCapability`
描述语义：
- session memory
- project memory
- user memory
- retrieval memory
- shared memory

2. `MemoryProvider`
描述实现者：
- `claude-native-memory`
- `openclaw-memory-slot`
- `suit-local-file-memory`
- `suit-redis-memory`
- `suit-rag-memory`

3. `MemoryBinding`
描述当前 runtime 最终采用哪个 provider

### 8.4 适配优先级建议

第一阶段建议：

1. `Claude Code`
原因：官方支持面最清晰，native mapping 多。

2. `Codex`
原因：instructions / skills / MCP / subagents 很强，适合作为第二优先。

3. `OpenClaw`
原因：虽然能力强，但更适合作为 extraction source 和 canonical capability 参考系。

### 8.5 注入顺序建议

建议 AgentSuit 统一一个逻辑顺序，再由各 adapter 落地：

```text
Base runtime defaults
  -> global/org instructions
  -> project instructions
  -> suit identity/prompt overlays
  -> suit skills
  -> suit tools / MCP bindings
  -> suit memory bindings
  -> suit coworkers / subagents
  -> suit policy / guardrails
```

不要让每个 adapter 自己发明顺序。

---

## 9. 建议补充的后续文档

在当前详设基础上，建议继续拆三份文档：

1. `docs/adapter_能力映射矩阵.md`
- 把 `prompt / skill / tool / memory / coworker / policy` 分项展开到每个 runtime

2. `docs/memory_provider_设计.md`
- 独立讨论 memory contract、provider、store、RAG、权限与审计

3. `docs/runtime_adapter_API草案.md`
- 明确 adapter interface、provider interface、plan/result model

---

## 10. 本次调研使用的主要资料

### Claude Code

- Claude Code settings
  - https://code.claude.com/docs/en/settings
- How Claude remembers your project
  - https://code.claude.com/docs/en/memory
- Connect Claude Code to tools via MCP
  - https://code.claude.com/docs/en/mcp
- Hooks reference
  - https://code.claude.com/docs/en/hooks
- Create custom subagents
  - https://code.claude.com/docs/en/sub-agents

### Codex

- Unrolling the Codex agent loop
  - https://openai.com/index/unrolling-the-codex-agent-loop/
- Config basics
  - https://developers.openai.com/codex/config-basic
- Advanced configuration
  - https://developers.openai.com/codex/config-advanced
- Configuration reference
  - https://developers.openai.com/codex/config-reference
- Model Context Protocol – Codex
  - https://developers.openai.com/codex/mcp
- Agent Skills – Codex
  - https://developers.openai.com/codex/skills
- Subagents – Codex
  - https://developers.openai.com/codex/subagents
- Docs MCP
  - https://developers.openai.com/learn/docs-mcp
- openai/codex docs
  - https://github.com/openai/codex/blob/main/docs/config.md

### OpenClaw

- Agent Runtime
  - https://openclaw.im/docs/concepts/agent
- Tools and Plugins
  - https://docs.openclaw.ai/tools
- Plugins
  - https://docs.openclaw.ai/tools/plugin
- Sub-Agents
  - https://docs.openclaw.ai/tools/subagents

---

## 11. 当前结论的边界

以下内容本次没有做深入验证，因此先不下强结论：

- Claude Code 插件 marketplace 的完整打包与发布协议
- Codex 是否已有官方“一等 persistent memory”能力但分散在其他文档
- OpenClaw ACP bridge 的完整事件模型与协议细节
- 三者在 tool permission / audit log / session transcript 格式上的精确对齐方式

换句话说，这份文档足够指导下一阶段架构设计，但还不足以直接开始写所有 adapter 代码。下一步最适合做的是：

- 按 capability 拆 adapter 设计
- 优先把 `Claude Code` 和 `Codex` 的具体映射矩阵写细
- 单独开 `memory provider` 设计文档
