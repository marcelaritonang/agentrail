import { describe, expect, it } from "vitest";

import { MemorySpanQueue } from "./memory.js";
import type { CanonicalSpanBatch } from "@agentrail-sdk/contracts";

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

describe("MemorySpanQueue", () => {
  it("enqueues one canonical batch and returns a message id", async () => {
    const queue = new MemorySpanQueue();
    const receipt = await queue.enqueue(batch);

    expect(receipt.messageId).toMatch(/^mem_/);
    await expect(queue.read()).resolves.toMatchObject({ body: batch });
  });

  it("releases a failed message with an incremented attempt", async () => {
    const queue = new MemorySpanQueue();
    await queue.enqueue(batch);
    const first = await queue.read();

    expect(first).not.toBeNull();
    await queue.fail(first!, "storage_unavailable");

    await expect(queue.read()).resolves.toMatchObject({
      body: batch,
      attempts: 2,
    });
  });
});
