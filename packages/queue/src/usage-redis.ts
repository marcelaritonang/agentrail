import { createClient, type RedisClientType } from "redis";

import {
  assertCanonicalUsageEventBatch,
  type CanonicalUsageEventBatch,
  type UsageEventQueue,
  type UsageQueueMessage,
} from "./usage-types.js";

type RedisUsageQueueOptions = {
  url: string;
  stream: string;
  group: string;
  consumer: string;
  blockMs?: number;
};

export async function createRedisUsageEventQueue(
  options: RedisUsageQueueOptions,
) {
  const client = createClient({ url: options.url });
  await client.connect();

  try {
    await client.sendCommand([
      "XGROUP",
      "CREATE",
      options.stream,
      options.group,
      "0",
      "MKSTREAM",
    ]);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) {
      client.destroy();
      throw error;
    }
  }

  return new RedisUsageEventQueue(client, options);
}

export class RedisUsageEventQueue implements UsageEventQueue {
  constructor(
    private readonly client: RedisClientType,
    private readonly options: RedisUsageQueueOptions,
  ) {}

  async enqueue(
    batch: CanonicalUsageEventBatch,
  ): Promise<{ messageId: string }> {
    assertCanonicalUsageEventBatch(batch);

    const messageId = await this.client.sendCommand<string>([
      "XADD",
      this.options.stream,
      "*",
      "body",
      JSON.stringify(batch),
      "attempts",
      "0",
    ]);
    return { messageId };
  }

  async read(): Promise<UsageQueueMessage | null> {
    const reply = await this.client.xReadGroup(
      this.options.group,
      this.options.consumer,
      { key: this.options.stream, id: ">" },
      { COUNT: 1, BLOCK: this.options.blockMs ?? 1_000 },
    );
    const entry = reply?.[0]?.messages[0];
    if (entry === undefined) {
      return null;
    }

    if (entry.message.body === undefined) {
      throw new Error("Redis stream message is missing body");
    }

    const body: unknown = JSON.parse(entry.message.body);
    assertCanonicalUsageEventBatch(body);

    return {
      messageId: entry.id,
      receipt: entry.id,
      body,
      attempts: Number(entry.message.attempts ?? "0") + 1,
    };
  }

  async ack(message: UsageQueueMessage): Promise<void> {
    await this.client.sendCommand([
      "XACK",
      this.options.stream,
      this.options.group,
      message.receipt,
    ]);
  }

  async fail(message: UsageQueueMessage, reason: string): Promise<void> {
    await this.ack(message);
    await this.client.sendCommand([
      "XADD",
      this.options.stream,
      "*",
      "body",
      JSON.stringify(message.body),
      "attempts",
      String(message.attempts),
      "last_failure",
      reason.slice(0, 120),
    ]);
  }

  async pendingCount(): Promise<number> {
    const reply = await this.client.sendCommand<unknown[]>([
      "XPENDING",
      this.options.stream,
      this.options.group,
    ]);
    return Number(reply[0] ?? 0);
  }

  async purge(): Promise<void> {
    await this.client.sendCommand(["DEL", this.options.stream]);
  }

  close(): void {
    this.client.destroy();
  }
}
