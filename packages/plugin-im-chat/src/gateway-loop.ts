import type {
  CreateDiscordGatewayLoopOptions,
  DiscordGatewayLoop,
} from "./types";

const defaultDiscordGatewayDurationMs = 10 * 60 * 1000;
const defaultDiscordGatewayRetryDelayMs = 1000;

export function createDiscordGatewayLoop(
  options: CreateDiscordGatewayLoopOptions,
): DiscordGatewayLoop {
  let abortController: AbortController | undefined;
  let loopPromise: Promise<void> | undefined;

  return {
    async start() {
      if (loopPromise) {
        return;
      }

      abortController = new AbortController();
      const ready = createDeferred<void>();
      loopPromise = runGatewayLoop(options, abortController.signal, ready);
      await ready.promise;
    },
    async stop() {
      abortController?.abort();

      try {
        await loopPromise;
      } finally {
        abortController = undefined;
        loopPromise = undefined;
      }
    },
  };
}

async function runGatewayLoop(
  options: CreateDiscordGatewayLoopOptions,
  signal: AbortSignal,
  ready: ReturnType<typeof createDeferred<void>>,
): Promise<void> {
  let firstAttempt = true;

  while (!signal.aborted) {
    let listenerTask = Promise.resolve();
    let registeredListenerTask = false;

    try {
      const response = await options.adapter.startGatewayListener(
        {
          waitUntil(task) {
            registeredListenerTask = true;
            listenerTask = Promise.resolve(task).then(() => undefined);
          },
        },
        options.durationMs ?? defaultDiscordGatewayDurationMs,
        signal,
        options.webhookUrl,
      );

      if (!response.ok) {
        throw new Error(
          `Failed to start Discord Gateway listener: ${await summarizeResponse(response)}`,
        );
      }

      if (!registeredListenerTask) {
        throw new Error(
          "Discord Gateway listener did not register a background task.",
        );
      }

      if (firstAttempt) {
        ready.resolve();
        firstAttempt = false;
      }

      await listenerTask;
    } catch (error) {
      if (signal.aborted) {
        if (firstAttempt) {
          ready.resolve();
        }
        break;
      }

      if (firstAttempt) {
        ready.reject(asError(error));
        return;
      }

      console.error(
        "Discord Gateway listener stopped unexpectedly; restarting.",
        error,
      );
      await delay(options.retryDelayMs ?? defaultDiscordGatewayRetryDelayMs);
    }
  }
}

async function summarizeResponse(response: Response): Promise<string> {
  const text = (await response.text()).trim();

  if (text.length > 0) {
    return `${response.status} ${response.statusText} - ${text}`;
  }

  return `${response.status} ${response.statusText}`.trim();
}

function createDeferred<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  let rejectPromise!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    reject(reason?: unknown) {
      rejectPromise(reason);
    },
    resolve(value: T | PromiseLike<T>) {
      resolvePromise(value);
    },
  };
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
