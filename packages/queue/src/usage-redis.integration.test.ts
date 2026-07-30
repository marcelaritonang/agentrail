import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CanonicalUsageEventBatch } from "./usage-types.js";
import { createRedisUsageEventQueue } from "./usage-redis.js";

const batch: CanonicalUsageEventBatch = {
  events: [
    {
      schema_version: 1,
      event_id: "ev_0123456789abcdefghijklmn",
      pack_id: "cp_0123456789abcdefghijklmn",
      event_type: "context_pack_created",
      occurred_at: "2026-07-29T10:00:00.000Z",
      project_id: "00000000-0000-4000-8000-000000000001",
      installation_id: "inst_00000000-0000-4000-8000-000000000001",
      received_at: "2026-07-29T10:00:01.000Z",
      safe_attributes: {
        client: "codex",
        package_version: "0.1.2",
        status: "ready",
        latency_ms: 1200,
        candidate_tokens_estimate: 2000,
        returned_tokens_estimate: 1200,
        source_counts: { file: 2 },
        warning_codes: [],
      },
    },
  ],
};

const suffix = `${process.pid}-${Date.now()}`;
const stream = `agentrail:test:usage:${suffix}`;
const group = `usage-workers:${suffix}`;
const consumer = `usage-worker:${suffix}`;
let queue: Awaited<ReturnType<typeof createRedisUsageEventQueue>>;

beforeAll(async () => {
  queue = await createRedisUsageEventQueue({
    url: process.env.TEST_REDIS_URL ?? "redis://localhost:6379",
    stream,
    group,
    consumer,
    blockMs: 50,
  });
});

afterAll(async () => {
  await queue.purge();
  queue.close();
});

describe("RedisUsageEventQueue", () => {
  it("writes one usage stream entry and acknowledges the consumer message", async () => {
    const receipt = await queue.enqueue(batch);
    const message = await queue.read();

    expect(receipt.messageId).toMatch(/^\d+-\d+$/);
    expect(message).toMatchObject({ body: batch, attempts: 1 });
    await queue.ack(message!);
    await expect(queue.pendingCount()).resolves.toBe(0);
  });
});
