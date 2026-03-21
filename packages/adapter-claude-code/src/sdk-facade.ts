import {
  type Options as ClaudeAgentSdkOptions,
  type McpServerConfig,
  type SDKMessage,
  type SDKResultMessage,
  query,
} from "@anthropic-ai/claude-agent-sdk";

export interface ClaudeSdkRunInput {
  cwd: string;
  env?: Record<string, string | undefined>;
  instructions: string;
  mcpServers?: Record<string, McpServerConfig>;
  model?: string;
  pathToClaudeCodeExecutable?: string;
  prompt: string;
}

export interface ClaudeSdkStreamEvent {
  error?: string;
  providerEventType: string;
  providerSessionId?: string;
  text?: string;
  type: "message-complete" | "session-error" | "text-delta";
}

export interface ClaudeSdkRun {
  close(): void;
  interrupt(): Promise<void>;
  stream(): AsyncIterable<ClaudeSdkStreamEvent>;
}

export interface ClaudeAgentSdkFacade {
  run(input: ClaudeSdkRunInput): ClaudeSdkRun | Promise<ClaudeSdkRun>;
}

export function createClaudeAgentSdkFacade(): ClaudeAgentSdkFacade {
  return {
    run(input) {
      const currentQuery = query({
        options: createClaudeQueryOptions(input),
        prompt: input.prompt,
      });

      return {
        close() {
          currentQuery.close();
        },
        async interrupt() {
          await currentQuery.interrupt();
        },
        stream() {
          return normalizeSdkStream(currentQuery);
        },
      };
    },
  };
}

function createClaudeQueryOptions(
  input: ClaudeSdkRunInput,
): ClaudeAgentSdkOptions {
  const options: ClaudeAgentSdkOptions = {
    cwd: input.cwd,
    systemPrompt: input.instructions
      ? {
          append: input.instructions,
          preset: "claude_code",
          type: "preset",
        }
      : {
          preset: "claude_code",
          type: "preset",
        },
    tools: {
      preset: "claude_code",
      type: "preset",
    },
  };

  if (input.env) {
    options.env = input.env;
  }

  if (input.mcpServers) {
    options.mcpServers = input.mcpServers;
  }

  if (input.model) {
    options.model = input.model;
  }

  if (input.pathToClaudeCodeExecutable) {
    options.pathToClaudeCodeExecutable = input.pathToClaudeCodeExecutable;
  }

  return options;
}

async function* normalizeSdkStream(
  stream: AsyncIterable<SDKMessage>,
): AsyncIterable<ClaudeSdkStreamEvent> {
  for await (const message of stream) {
    if (message.type === "assistant") {
      const text = extractAssistantText(message.message);

      if (text) {
        yield {
          providerEventType: "sdk.assistant",
          providerSessionId: message.session_id,
          text,
          type: "text-delta",
        };
      }

      continue;
    }

    if (message.type !== "result") {
      continue;
    }

    const resultMessage = message as SDKResultMessage;

    if (resultMessage.subtype !== "success") {
      yield {
        error:
          resultMessage.errors[0] ?? "Claude Code reported an unknown error.",
        providerEventType: `sdk.result.${resultMessage.subtype}`,
        providerSessionId: resultMessage.session_id,
        type: "session-error",
      };
      continue;
    }

    yield {
      providerEventType: "sdk.result.success",
      providerSessionId: resultMessage.session_id,
      type: "message-complete",
    };
  }
}

function extractAssistantText(message: { content?: unknown }): string {
  if (!Array.isArray(message.content)) {
    return "";
  }

  const textBlocks = message.content.flatMap((block) => {
    if (
      !block ||
      typeof block !== "object" ||
      !("type" in block) ||
      block.type !== "text" ||
      !("text" in block) ||
      typeof block.text !== "string"
    ) {
      return [];
    }

    return [block.text];
  });

  return textBlocks.join("\n").trim();
}
