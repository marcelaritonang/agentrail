import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { MemorySpanQueue, type UsageEventQueue } from "@agentrail-sdk/queue";
import { createIngestApp, type IngestDependencies } from "./app.js";

const API_KEY = `ar_live_${"a".repeat(64)}`;
const INSTALLATION_CREDENTIAL = `ar_inst_${"b".repeat(43)}`;
const PEPPER = "installation-test-pepper";
const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const INSTALLATION_ID = "inst_00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-07-29T10:00:01.000Z");

function usageEvent(index = 0) {
  return {
    schema_version: 1,
    event_id: `ev_${String(index).padStart(24, "0")}`,
    pack_id: `cp_${String(index).padStart(24, "1")}`,
    event_type: "context_pack_created",
    occurred_at: "2026-07-29T10:00:00.000Z",
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
  };
}

function request(body: unknown): Request {
  return new Request("http://localhost/v1/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INSTALLATION_CREDENTIAL}`,
      "Content-Type": "application/json",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function dependencies(
  usageQueue: UsageEventQueue,
  overrides: Partial<IngestDependencies> = {},
): IngestDependencies {
  return {
    apiKeyPepper: "unused",
    apiKeys: { findActiveByPrefix: async () => null },
    queue: new MemorySpanQueue(),
    installationCredentialPepper: PEPPER,
    installations: {
      findActiveInstallationByPrefix: async () => ({
        projectId: PROJECT_ID,
        installationId: INSTALLATION_ID,
        credentialDigest: createHmac("sha256", PEPPER)
          .update(INSTALLATION_CREDENTIAL)
          .digest("hex"),
      }),
    },
    usageQueue,
    now: () => NOW,
    requestId: () => "req_usage",
    ...overrides,
  };
}

describe("POST /v1/events", () => {
  it("canonicalizes project and installation from the credential and returns 202 only after enqueue", async () => {
    const gate = Promise.withResolvers<{ messageId: string }>();
    const enqueue = vi.fn(() => gate.promise);
    const app = createIngestApp(
      dependencies({
        enqueue,
        read: async () => null,
        ack: async () => undefined,
        fail: async () => undefined,
      }),
    );

    const pending = app.request(request({ events: [usageEvent()] }));
    await expect(
      Promise.race([pending, Promise.resolve("still-pending")]),
    ).resolves.toBe("still-pending");
    enqueue.mock.invocationCallOrder;
    gate.resolve({ messageId: "usage-1" });

    const response = await pending;
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      accepted: 1,
      request_id: "req_usage",
    });
    expect(enqueue).toHaveBeenCalledWith({
      events: [
        expect.objectContaining({
          project_id: PROJECT_ID,
          installation_id: INSTALLATION_ID,
          received_at: "2026-07-29T10:00:01.000Z",
        }),
      ],
    });
  });

  it("rejects client-supplied project or installation identifiers", async () => {
    const enqueue = vi.fn(async () => ({ messageId: "unexpected" }));
    const app = createIngestApp(
      dependencies({
        enqueue,
        read: async () => null,
        ack: async () => undefined,
        fail: async () => undefined,
      }),
    );

    const response = await app.request(
      request({
        events: [
          {
            ...usageEvent(),
            project_id: PROJECT_ID,
            installation_id: INSTALLATION_ID,
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_usage_event_batch" },
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects batches over 100 events", async () => {
    const enqueue = vi.fn(async () => ({ messageId: "unexpected" }));
    const app = createIngestApp(
      dependencies({
        enqueue,
        read: async () => null,
        ack: async () => undefined,
        fail: async () => undefined,
      }),
    );

    const response = await app.request(
      request({
        events: Array.from({ length: 101 }, (_, index) => usageEvent(index)),
      }),
    );

    expect(response.status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects forbidden safe attributes", async () => {
    const enqueue = vi.fn(async () => ({ messageId: "unexpected" }));
    const app = createIngestApp(
      dependencies({
        enqueue,
        read: async () => null,
        ack: async () => undefined,
        fail: async () => undefined,
      }),
    );

    const event = usageEvent();
    const response = await app.request(
      request({
        events: [
          {
            ...event,
            safe_attributes: {
              ...event.safe_attributes,
              prompt: "must-not-pass",
            },
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects oversized event request bodies", async () => {
    const enqueue = vi.fn(async () => ({ messageId: "unexpected" }));
    const app = createIngestApp(
      dependencies({
        enqueue,
        read: async () => null,
        ack: async () => undefined,
        fail: async () => undefined,
      }),
    );

    const response = await app.request(request(" ".repeat(240 * 1024 + 1)));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "body_too_large" },
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns 401 for revoked credentials", async () => {
    const enqueue = vi.fn(async () => ({ messageId: "unexpected" }));
    const app = createIngestApp(
      dependencies(
        {
          enqueue,
          read: async () => null,
          ack: async () => undefined,
          fail: async () => undefined,
        },
        {
          installations: {
            findActiveInstallationByPrefix: async () => null,
          },
        },
      ),
    );

    const response = await app.request(request({ events: [usageEvent()] }));

    expect(response.status).toBe(401);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns retryable 503 when queue enqueue fails", async () => {
    const app = createIngestApp(
      dependencies({
        enqueue: async () => {
          throw new Error("queue down");
        },
        read: async () => null,
        ack: async () => undefined,
        fail: async () => undefined,
      }),
    );

    const response = await app.request(request({ events: [usageEvent()] }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "queue_unavailable", retryable: true },
    });
  });

  it("does not require or call a direct DB usage-event insert dependency", async () => {
    const enqueue = vi.fn(async () => ({ messageId: "usage-1" }));
    const insertUsageEvent = vi.fn(async () => {
      throw new Error("must not insert synchronously");
    });
    const app = createIngestApp(
      dependencies(
        {
          enqueue,
          read: async () => null,
          ack: async () => undefined,
          fail: async () => undefined,
        },
        { insertUsageEvent } as unknown as Partial<IngestDependencies>,
      ),
    );

    const response = await app.request(request({ events: [usageEvent()] }));

    expect(response.status).toBe(202);
    expect(insertUsageEvent).not.toHaveBeenCalled();
  });
});
