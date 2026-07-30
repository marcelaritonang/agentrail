import type { UsageEventQueue } from "@agentrail-sdk/queue";
import {
  processUsageBatch,
  type UsageWorkerRepository,
} from "./process-usage.js";

export type UsageWorkerDependencies = {
  queue: UsageEventQueue;
  repository: UsageWorkerRepository;
};

export async function consumeUsageOnce(
  dependencies: UsageWorkerDependencies,
): Promise<boolean> {
  const message = await dependencies.queue.read();
  if (message === null) return false;

  try {
    await processUsageBatch(
      { repository: dependencies.repository },
      message.body,
    );
    await dependencies.queue.ack(message);
  } catch (error) {
    const safeReason = error instanceof Error ? error.name : "UnknownError";
    await dependencies.queue.fail(message, safeReason);
    throw error;
  }
  return true;
}

export async function runUsageWorker(
  dependencies: UsageWorkerDependencies,
  options: { signal: AbortSignal; idleDelayMs?: number },
): Promise<void> {
  while (!options.signal.aborted) {
    let consumed = false;
    try {
      consumed = await consumeUsageOnce(dependencies);
    } catch {
      // The queue adapter has already made the message retryable.
    }
    if (!consumed) {
      await new Promise((resolve) =>
        setTimeout(resolve, options.idleDelayMs ?? 100),
      );
    }
  }
}
