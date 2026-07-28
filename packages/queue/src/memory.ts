import type { CanonicalSpanBatch } from "@agentrail-sdk/contracts";

import type { QueueMessage, SpanQueue } from "./types.js";

type StoredMessage = {
  messageId: string;
  body: CanonicalSpanBatch;
  completedAttempts: number;
};

export class MemorySpanQueue implements SpanQueue {
  readonly #available: StoredMessage[] = [];
  readonly #inFlight = new Map<string, StoredMessage>();
  #sequence = 0;

  async enqueue(batch: CanonicalSpanBatch): Promise<{ messageId: string }> {
    const messageId = `mem_${++this.#sequence}`;
    this.#available.push({ messageId, body: batch, completedAttempts: 0 });
    return { messageId };
  }

  async read(): Promise<QueueMessage | null> {
    const stored = this.#available.shift();
    if (stored === undefined) {
      return null;
    }

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

  async ack(message: QueueMessage): Promise<void> {
    this.#inFlight.delete(message.receipt);
  }

  async fail(message: QueueMessage, _reason: string): Promise<void> {
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
