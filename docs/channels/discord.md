# Discord Channel 接入

本文档描述如何把 AgentSuit runtime 通过 `packages/plugin-im-chat` 暴露到 Discord。

当前范围是 Discord 文本流式 MVP：

- 入口命令：`suit serve <path> --expose im --im-adapter discord`
- 会话绑定：`Discord thread.id -> runtimeSessionId`
- 输出模式：runtime `message.delta` / `message.completed` -> Discord 流式文本回复
- 显式停止：在已订阅线程内发送 `stop` 或 `/stop`

一个 agent 可以同时服务多个 Discord channel / guild / thread / DM。当前实现不是“一个 agent 绑一个群”，而是“一个 Discord adapter 实例监听多个 thread，并为每个 thread 维护独立的 runtime session 映射”。

官方 Discord adapter 文档：

- https://chat-sdk.dev/adapters/discord

Channel plugin discovery 细节：

- [./plugin-discovery.md](./plugin-discovery.md)

## 前置条件

- Bun `1.3.5` 或更新版本
- 一个可通过 `suit validate` 的 Suit
- Discord application ID
- Discord application public key
- Discord bot token

## 环境变量

最小必需环境变量：

```bash
export DISCORD_APPLICATION_ID=your-discord-application-id
export DISCORD_BOT_TOKEN=your-discord-bot-token
export DISCORD_PUBLIC_KEY=your-discord-public-key
```

当前 `plugin-im-chat` MVP 支持的环境变量：

 - `DISCORD_APPLICATION_ID`: Discord application ID，必填
- `DISCORD_BOT_TOKEN`: Discord bot token，必填
 - `DISCORD_PUBLIC_KEY`: Discord application public key，必填
- `AGENTSUIT_IM_STATE`: IM plugin state backend，当前只支持 `memory`
- `AGENTSUIT_BASE_AGENT`: runtime base agent 缺省值
- `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` / 其他 Claude provider 变量：当 `--base-agent claude-code` 时按 Claude adapter 需要提供

## 本地启动

默认 mock base agent：

```bash
./node_modules/.bin/suit serve examples/suits/minimal-starter \
  --expose im \
  --im-adapter discord
```

接 Claude Code adapter：

```bash
DISCORD_APPLICATION_ID=$DISCORD_APPLICATION_ID \
DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN \
DISCORD_PUBLIC_KEY=$DISCORD_PUBLIC_KEY \
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
./node_modules/.bin/suit serve examples/suits/minimal-starter \
  --base-agent claude-code \
  --expose im \
  --im-adapter discord
```

启动成功后：

- runtime 仍会打印 `Health: http://.../healthz`
- IM 暴露层会打印 `Exposure: im/discord`
- Discord Gateway listener 会由 `plugin-im-chat` 在进程内自动拉起，用于接收普通消息 / mention / DM

## Docker 启动

先构建镜像：

```bash
docker build -f Dockerfile.runtime -t agentsuit/runtime:latest .
```

再以单容器方式运行：

```bash
docker run --rm -p 8080:8080 \
  -e DISCORD_APPLICATION_ID=$DISCORD_APPLICATION_ID \
  -e DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN \
  -e DISCORD_PUBLIC_KEY=$DISCORD_PUBLIC_KEY \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e AGENTSUIT_BASE_AGENT=claude-code \
  -v $PWD/examples/suits/minimal-starter:/app/suit:ro \
  -v agentsuit-state:/app/state \
  -v agentsuit-reports:/app/reports \
  agentsuit/runtime:latest serve /app/suit \
  --host 0.0.0.0 \
  --port 8080 \
  --expose im \
  --im-adapter discord
```

如果只想先验证插件装配链路，也可以先不传 Claude 相关环境变量，改用默认 mock runtime。

## 当前行为约束

- `discord` 当前通过 discovered plugin definition 暴露，而不是由 `suit` 命令硬编码平台实现
- 单个 Discord adapter 实例可以同时监听多个 channel / thread / DM
- 长驻的 `suit serve` 进程会自动维持 Discord Gateway 监听窗口，不需要额外再手动起一个 gateway route
- 只有 `memory` state backend 被支持
- 首版只处理文本流式回复，不处理 cards / buttons / modals
- 首版不做自动抢占；显式 stop 才会触发 `runtime interrupt(sessionId)`
- `session.failed` 会向线程回发确定性失败消息，并清理线程到会话映射

## 排障

缺少 Discord 配置时，`suit serve` 会直接失败：

```text
Missing Discord IM configuration: set "DISCORD_BOT_TOKEN".
```

如果缺少 application key / id，也会在启动前直接失败：

```text
Missing Discord IM configuration: set "DISCORD_PUBLIC_KEY".
Missing Discord IM configuration: set "DISCORD_APPLICATION_ID".
```

如果选择了当前未内置注册的 IM adapter，也会直接失败：

```text
Unsupported IM adapter "slack". Only "discord" is currently supported.
```

这两类失败都发生在 runtime 正式对外服务前，避免系统进入半启动状态。
