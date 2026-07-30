import type { UsageEvent } from "@agentrail-sdk/contracts";

export type CanonicalUsageEvent = UsageEvent & {
  project_id: string;
  installation_id: string;
  received_at: string;
};

export type CanonicalUsageEventBatch = {
  events: readonly CanonicalUsageEvent[];
};

export type UsageQueueMessage = {
  messageId: string;
  receipt: string;
  body: CanonicalUsageEventBatch;
  attempts: number;
};

export interface UsageEventQueue {
  enqueue(batch: CanonicalUsageEventBatch): Promise<{ messageId: string }>;
  read(): Promise<UsageQueueMessage | null>;
  ack(message: UsageQueueMessage): Promise<void>;
  fail(message: UsageQueueMessage, reason: string): Promise<void>;
}

export function assertCanonicalUsageEventBatch(
  value: unknown,
): asserts value is CanonicalUsageEventBatch {
  if (
    typeof value !== "object" ||
    value === null ||
    !("events" in value) ||
    !Array.isArray((value as { events?: unknown }).events)
  ) {
    throw new Error("Invalid usage event batch");
  }

  const batch = value as { events: unknown[] };
  if (batch.events.length === 0 || batch.events.length > 100) {
    throw new Error("Invalid usage event batch");
  }

  for (const event of batch.events) {
    if (
      typeof event !== "object" ||
      event === null ||
      !hasString(event, "project_id") ||
      !hasString(event, "installation_id") ||
      !hasString(event, "received_at")
    ) {
      throw new Error("Invalid usage event batch");
    }
  }
}

function hasString(value: object, key: string): boolean {
  return (
    key in value &&
    typeof (value as Record<string, unknown>)[key] === "string" &&
    ((value as Record<string, unknown>)[key] as string).length > 0
  );
}
