import { describe, expect, it, vi } from "vitest";

import type { CanonicalSpanBatch } from "@agentrail-sdk/contracts";
import { digestApiKey } from "./api-key.js";
import { createIngestApp, type IngestDependencies } from "./app.js";

const API_KEY = `ar_live_${"a".repeat(64)}`;
const PEPPER = "test-pepper";
const PROJECT_ID = "00000000-0000-4000-8000-000000000001";

function validBody() {
  return {
    spans: [
      {
        schema_version: 1,
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
}

function request(body: unknown = validBody(), apiKey = API_KEY): Request {
  return new Request("http://localhost/v1/spans", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function testDependencies(
  enqueue: (batch: CanonicalSpanBatch) => Promise<{ messageId: string }>,
): IngestDependencies {
  return {
    apiKeyPepper: PEPPER,
    apiKeys: {
      findActiveByPrefix: async () => ({
        projectId: PROJECT_ID,
        keyDigest: digestApiKey(API_KEY, PEPPER),
      }),
    },
    queue: {
      enqueue,
      read: async () => null,
      ack: async () => undefined,
      fail: async () => undefined,
    },
    requestId: () => "req_test",
  };
}

describe("POST /v1/spans", () => {
  it("returns 202 only after one enqueue resolves", async () => {
    const gate = Promise.withResolvers<{ messageId: string }>();
    const enqueue = vi.fn(() => gate.promise);
    const app = createIngestApp(testDependencies(enqueue));

    const pending = app.request(request());
    await expect(
      Promise.race([pending, Promise.resolve("still-pending")]),
    ).resolves.toBe("still-pending");
    gate.resolve({ messageId: "msg_1" });

    const response = await pending;
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      accepted: 1,
      request_id: "req_test",
    });
    expect(enqueue).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledWith({
      spans: [expect.objectContaining({ project_id: PROJECT_ID })],
    });
  });

  it("returns retryable 503 and no 202 when enqueue fails", async () => {
    const app = createIngestApp(
      testDependencies(async () => {
        throw new Error("redis down");
      }),
    );

    const response = await app.request(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "queue_unavailable", retryable: true },
    });
  });

  it("rejects invalid credentials before enqueue", async () => {
    const enqueue = vi.fn(async () => ({ messageId: "unexpected" }));
    const app = createIngestApp(testDependencies(enqueue));

    const response = await app.request(request(validBody(), "ar_live_wrong"));
    expect(response.status).toBe(401);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns structured 400 for an invalid span envelope", async () => {
    const enqueue = vi.fn(async () => ({ messageId: "unexpected" }));
    const app = createIngestApp(testDependencies(enqueue));

    const response = await app.request(request({ spans: [] }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_span_batch" },
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before enqueue", async () => {
    const enqueue = vi.fn(async () => ({ messageId: "unexpected" }));
    const app = createIngestApp(testDependencies(enqueue));
    const body = validBody();
    body.spans[0]!.payload = "x".repeat(250_000);

    const response = await app.request(request(body));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "body_too_large" },
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the project limiter rejects", async () => {
    const enqueue = vi.fn(async () => ({ messageId: "unexpected" }));
    const dependencies = testDependencies(enqueue);
    dependencies.rateLimit = async () => false;
    const app = createIngestApp(dependencies);

    const response = await app.request(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns structured 400 for malformed JSON", async () => {
    const enqueue = vi.fn(async () => ({ messageId: "unexpected" }));
    const app = createIngestApp(testDependencies(enqueue));
    const malformed = new Request("http://localhost/v1/spans", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: "{",
    });

    const response = await app.request(malformed);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_json" },
    });
    expect(enqueue).not.toHaveBeenCalled();
  });
});
