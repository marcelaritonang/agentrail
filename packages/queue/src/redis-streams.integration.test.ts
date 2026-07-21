import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CanonicalSpanBatch } from "@agentrail/contracts";
import { createRedisStreamsQueue } from "./redis-streams.js";

const batch: CanonicalSpanBatch = {
  spans: [
    {
      schema_version: 1,
      project_id: "00000000-0000-4000-8000-000000000001",
      trace_id: "0af7651916cd43dd8448eb211c80319c",
      span_id: "b7ad6b7169203331",
      parent_span_id: null,
      trace_name: "research.answer",
      kind: "llm",
      name: "plan",
      agent_id: "research-agent",
      on_behalf_of: "user_42",
      started_at: "2026-07-21T10:00:00.000Z",
      ended_at: "2026-07-21T10:00:01.000Z",
      outcome: "ok",
      attributes: {},
    },
  ],
};

const suffix = `${process.pid}-${Date.now()}`;
const stream = `agentrail:test:${suffix}`;
const group = `workers:${suffix}`;
const consumer = `worker:${suffix}`;
let queue: Awaited<ReturnType<typeof createRedisStreamsQueue>>;

beforeAll(async () => {
  queue = await createRedisStreamsQueue({
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

describe("RedisStreamsQueue", () => {
  it("writes one stream entry and acknowledges the consumer message", async () => {
    const receipt = await queue.enqueue(batch);
    const message = await queue.read();

    expect(receipt.messageId).toMatch(/^\d+-\d+$/);
    expect(message).toMatchObject({ body: batch, attempts: 1 });
    await queue.ack(message!);
    await expect(queue.pendingCount()).resolves.toBe(0);
  });
});
