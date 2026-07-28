import type { BlobStore } from "@agentrail-sdk/blob";
import type { SpanQueue } from "@agentrail-sdk/queue";
import { processBatch, type WorkerRepository } from "./process-batch.js";

export type WorkerDependencies = {
  queue: SpanQueue;
  repository: WorkerRepository;
  blob: BlobStore;
};

export async function consumeOnce(
  dependencies: WorkerDependencies,
): Promise<boolean> {
  const message = await dependencies.queue.read();
  if (message === null) return false;

  try {
    await processBatch(dependencies, message.body);
    await dependencies.queue.ack(message);
  } catch (error) {
    const safeReason = error instanceof Error ? error.name : "UnknownError";
    await dependencies.queue.fail(message, safeReason);
    throw error;
  }
  return true;
}

export async function runWorker(
  dependencies: WorkerDependencies,
  options: { signal: AbortSignal; idleDelayMs?: number },
): Promise<void> {
  while (!options.signal.aborted) {
    let consumed = false;
    try {
      consumed = await consumeOnce(dependencies);
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
