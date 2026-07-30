import {
  assertCanonicalUsageEventBatch,
  type CanonicalUsageEventBatch,
  type UsageEventQueue,
  type UsageQueueMessage,
} from "./usage-types.js";

type StoredMessage = {
  messageId: string;
  body: CanonicalUsageEventBatch;
  completedAttempts: number;
};

export class MemoryUsageEventQueue implements UsageEventQueue {
  readonly #available: StoredMessage[] = [];
  readonly #inFlight = new Map<string, StoredMessage>();
  #sequence = 0;

  async enqueue(
    batch: CanonicalUsageEventBatch,
  ): Promise<{ messageId: string }> {
    assertCanonicalUsageEventBatch(batch);

    const messageId = `mem-${++this.#sequence}`;
    this.#available.push({ messageId, body: batch, completedAttempts: 0 });
    return { messageId };
  }

  async read(): Promise<UsageQueueMessage | null> {
    const stored = this.#available.shift();
    if (stored === undefined) {
      return null;
    }

    assertCanonicalUsageEventBatch(stored.body);

    const attempts = stored.completedAttempts + 1;
    const receipt = `${stored.messageId}:${attempts}`;
    this.#inFlight.set(receipt, stored);

    return {
      messageId: stored.messageId,
      receipt,
      body: stored.body,
      attempts,
    };
  }

  async ack(message: UsageQueueMessage): Promise<void> {
    this.#inFlight.delete(message.receipt);
  }

  async fail(message: UsageQueueMessage, _reason: string): Promise<void> {
    const stored = this.#inFlight.get(message.receipt);
    if (stored === undefined) {
      return;
    }

    this.#inFlight.delete(message.receipt);
    this.#available.unshift({
      ...stored,
      completedAttempts: message.attempts,
    });
  }
}
