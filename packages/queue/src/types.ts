import type { CanonicalSpanBatch } from "@agentrail-sdk/contracts";

export type QueueMessage = {
  messageId: string;
  receipt: string;
  body: CanonicalSpanBatch;
  attempts: number;
};

export interface SpanQueue {
  enqueue(batch: CanonicalSpanBatch): Promise<{ messageId: string }>;
  read(): Promise<QueueMessage | null>;
  ack(message: QueueMessage): Promise<void>;
  fail(message: QueueMessage, reason: string): Promise<void>;
}
