import { describe, expect, it, vi } from "vitest";

import { MemoryBlobStore } from "@agentrail/blob";
import type { QueueMessage, SpanQueue } from "@agentrail/queue";
import { consumeOnce } from "./main.js";
import type { WorkerRepository } from "./process-batch.js";

const message: QueueMessage = {
  messageId: "msg_1",
  receipt: "receipt_1",
  attempts: 1,
  body: {
    spans: [
      {
        schema_version: 1,
        project_id: "00000000-0000-4000-8000-000000000001",
        trace_id: "0af7651916cd43dd8448eb211c80319c",
        span_id: "b7ad6b7169203331",
        parent_span_id: null,
        trace_name: "research.answer",
        kind: "custom",
        name: "compose",
        agent_id: "research-agent",
        on_behalf_of: null,
        started_at: "2026-07-21T10:00:00.000Z",
        ended_at: "2026-07-21T10:00:01.000Z",
        outcome: "ok",
        attributes: {},
      },
    ],
  },
};

function queue(overrides: Partial<SpanQueue> = {}): SpanQueue {
  return {
    enqueue: async () => ({ messageId: "unused" }),
    read: async () => message,
    ack: async () => undefined,
    fail: async () => undefined,
    ...overrides,
  };
}

function repository(
  overrides: Partial<WorkerRepository> = {},
): WorkerRepository {
  return {
    getProject: async () => ({
      projectId: "00000000-0000-4000-8000-000000000001",
      payloadMode: "none",
    }),
    getSpan: async () => null,
    insertSpan: async () => "inserted",
    recomputeTrace: async () => undefined,
    markIncompleteBefore: async () => 0,
    ...overrides,
  };
}

describe("consumeOnce", () => {
  it("acknowledges only after durable processing completes", async () => {
    const order: string[] = [];
    const workerQueue = queue({
      ack: vi.fn(async () => {
        order.push("ack");
      }),
    });
    const workerRepository = repository({
      insertSpan: vi.fn(async () => {
        order.push("insert");
        return "inserted";
      }),
      recomputeTrace: vi.fn(async () => {
        order.push("recompute");
      }),
    });

    await expect(
      consumeOnce({
        queue: workerQueue,
        repository: workerRepository,
        blob: new MemoryBlobStore(),
      }),
    ).resolves.toBe(true);
    expect(order).toEqual(["insert", "recompute", "ack"]);
  });

  it("fails without acknowledging when a durable write throws", async () => {
    const failure = new Error("database unavailable");
    const ack = vi.fn(async () => undefined);
    const fail = vi.fn(async () => undefined);
    const workerQueue = queue({ ack, fail });

    await expect(
      consumeOnce({
        queue: workerQueue,
        repository: repository({
          insertSpan: async () => {
            throw failure;
          },
        }),
        blob: new MemoryBlobStore(),
      }),
    ).rejects.toBe(failure);
    expect(ack).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(message, "Error");
  });
});
