import type { UsageEventQueue, UsageQueueMessage } from "@agentrail-sdk/queue";
import { describe, expect, it, vi } from "vitest";

import { consumeUsageOnce } from "./usage-main.js";
import type { UsageWorkerRepository } from "./process-usage.js";

const message: UsageQueueMessage = {
  messageId: "msg_usage_1",
  receipt: "receipt_usage_1",
  attempts: 1,
  body: {
    events: [
      {
        schema_version: 1,
        project_id: "00000000-0000-4000-8000-000000000001",
        installation_id: "inst_01",
        received_at: "2026-07-30T00:00:05.000Z",
        event_id: "ev_000000000000000000000001",
        pack_id: "cp_000000000000000000000001",
        event_type: "context_pack_created",
        occurred_at: "2026-07-30T00:00:00.000Z",
        safe_attributes: {
          client: "mcp",
          package_version: "0.1.2",
          status: "ready",
          latency_ms: 32,
          candidate_tokens_estimate: 2_000,
          returned_tokens_estimate: 800,
          source_counts: { project_source: 1 },
          warning_codes: [],
        },
      },
    ],
  },
};

function queue(overrides: Partial<UsageEventQueue> = {}): UsageEventQueue {
  return {
    enqueue: async () => ({ messageId: "unused" }),
    read: async () => message,
    ack: async () => undefined,
    fail: async () => undefined,
    ...overrides,
  };
}

function repository(
  overrides: Partial<UsageWorkerRepository> = {},
): UsageWorkerRepository {
  return {
    insertUsageEvent: async () => "inserted",
    upsertContextPack: async () => undefined,
    markInstallationUsage: async () => undefined,
    incrementDailyUsage: async () => undefined,
    ...overrides,
  };
}

describe("consumeUsageOnce", () => {
  it("acknowledges only after idempotent usage processing completes", async () => {
    const order: string[] = [];
    const usageQueue = queue({
      ack: vi.fn(async () => {
        order.push("ack");
      }),
    });
    const usageRepository = repository({
      insertUsageEvent: vi.fn(async () => {
        order.push("insert");
        return "inserted";
      }),
      upsertContextPack: vi.fn(async () => {
        order.push("pack");
      }),
      markInstallationUsage: vi.fn(async () => {
        order.push("installation");
      }),
      incrementDailyUsage: vi.fn(async () => {
        order.push("daily");
      }),
    });

    await expect(
      consumeUsageOnce({ queue: usageQueue, repository: usageRepository }),
    ).resolves.toBe(true);
    expect(order).toEqual(["insert", "pack", "installation", "daily", "ack"]);
  });

  it("fails the queue message when worker processing throws", async () => {
    const failure = new Error("database unavailable");
    const ack = vi.fn(async () => undefined);
    const fail = vi.fn(async () => undefined);

    await expect(
      consumeUsageOnce({
        queue: queue({ ack, fail }),
        repository: repository({
          insertUsageEvent: async () => {
            throw failure;
          },
        }),
      }),
    ).rejects.toBe(failure);

    expect(ack).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(message, "Error");
  });
});
