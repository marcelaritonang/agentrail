import { describe, expect, it } from "vitest";

import { MemoryUsageEventQueue } from "./usage-memory.js";
import type { CanonicalUsageEventBatch } from "./usage-types.js";

function usageBatch(): CanonicalUsageEventBatch {
  return {
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
          warning_codes: ["truncated"],
        },
      },
    ],
  };
}

describe("MemoryUsageEventQueue", () => {
  it("enqueues and reads canonical usage event batches", async () => {
    const queue = new MemoryUsageEventQueue();

    const result = await queue.enqueue(usageBatch());
    const message = await queue.read();

    expect(result.messageId).toBe("mem-1");
    expect(message).toMatchObject({
      messageId: "mem-1",
      receipt: "mem-1:1",
      attempts: 1,
      body: usageBatch(),
    });
  });

  it("rejects span-shaped bodies so span and usage queues cannot be mixed", async () => {
    const queue = new MemoryUsageEventQueue();

    await expect(
      queue.enqueue({ spans: [] } as unknown as CanonicalUsageEventBatch),
    ).rejects.toThrow(/usage event batch/i);
  });
});
