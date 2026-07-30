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

describe("device activation endpoints", () => {
  function activationDependencies(
    overrides: Partial<IngestDependencies> = {},
  ): IngestDependencies {
    return {
      ...testDependencies(async () => ({ messageId: "unused" })),
      activationBaseUrl: "https://agentrail.id/activate",
      installationCredentialPepper: "pepper-32-bytes-or-more",
      now: () => new Date("2026-07-30T08:00:00.000Z"),
      deviceIssueRateLimit: async () => true,
      deviceCodes: {
        issueDeviceCode: async () => undefined,
        consumeApprovedDeviceCode: async () => ({
          status: "authorization_pending",
        }),
      },
      ...overrides,
    } as IngestDependencies;
  }

  function deviceCodeRequest(
    body: unknown = {
      schema_version: 1,
      client_type: "codex",
      package_version: "0.1.2",
    },
  ): Request {
    return new Request("http://localhost/v1/device/code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.42",
      },
      body: JSON.stringify(body),
    });
  }

  function tokenRequest(deviceCode = `ar_dc_${"b".repeat(48)}`): Request {
    return new Request("http://localhost/v1/device/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schema_version: 1, device_code: deviceCode }),
    });
  }

  it("issues a device code with only digest material persisted", async () => {
    const issueDeviceCode = vi.fn(async () => undefined);
    const deviceIssueRateLimit = vi.fn(async () => true);
    const app = createIngestApp(
      activationDependencies({
        deviceIssueRateLimit,
        deviceCodes: {
          issueDeviceCode,
          consumeApprovedDeviceCode: async () => ({
            status: "authorization_pending",
          }),
        },
      }),
    );

    const response = await app.request(deviceCodeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      verification_uri: "https://agentrail.id/activate",
      expires_in: 600,
      interval: 5,
      request_id: "req_test",
    });
    expect(body.device_code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(body.verification_uri_complete).toBe(
      `https://agentrail.id/activate?code=${body.user_code}`,
    );

    expect(issueDeviceCode).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceCodeDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        userCodeDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        clientType: "codex",
        packageVersion: "0.1.2",
        expiresAt: new Date("2026-07-30T08:10:00.000Z"),
      }),
    );
    const persisted = JSON.stringify(issueDeviceCode.mock.calls[0]?.[0]);
    expect(persisted).not.toContain(body.device_code);
    expect(persisted).not.toContain(body.user_code);
    expect(deviceIssueRateLimit).toHaveBeenCalledWith({
      clientType: "codex",
      ipHash: expect.stringMatching(/^[a-f0-9]{32}$/),
    });
    expect(JSON.stringify(deviceIssueRateLimit.mock.calls)).not.toContain(
      "203.0.113.42",
    );
  });

  it("rejects device code issuance when the bounded IP/client limiter rejects", async () => {
    const issueDeviceCode = vi.fn(async () => undefined);
    const app = createIngestApp(
      activationDependencies({
        deviceIssueRateLimit: async () => false,
        deviceCodes: {
          issueDeviceCode,
          consumeApprovedDeviceCode: async () => ({
            status: "authorization_pending",
          }),
        },
      }),
    );

    const response = await app.request(deviceCodeRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({
      status: "slow_down",
      request_id: "req_test",
    });
    expect(issueDeviceCode).not.toHaveBeenCalled();
  });

  it("maps polling states before approval, slow polling, and expiry", async () => {
    const consumeApprovedDeviceCode = vi
      .fn()
      .mockResolvedValueOnce({ status: "authorization_pending" })
      .mockResolvedValueOnce({ status: "slow_down" })
      .mockResolvedValueOnce({ status: "expired_token" });
    const app = createIngestApp(
      activationDependencies({
        deviceCodes: {
          issueDeviceCode: async () => undefined,
          consumeApprovedDeviceCode,
        },
      }),
    );

    const pending = await app.request(tokenRequest());
    const slow = await app.request(tokenRequest());
    const expired = await app.request(tokenRequest());

    expect(pending.status).toBe(202);
    await expect(pending.json()).resolves.toMatchObject({
      status: "authorization_pending",
      interval: 5,
    });
    expect(slow.status).toBe(429);
    await expect(slow.json()).resolves.toMatchObject({
      status: "slow_down",
      interval: 5,
    });
    expect(expired.status).toBe(400);
    await expect(expired.json()).resolves.toMatchObject({
      status: "expired_token",
    });
    expect(consumeApprovedDeviceCode).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceCodeDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        minimumPollIntervalSeconds: 5,
      }),
    );
    expect(JSON.stringify(consumeApprovedDeviceCode.mock.calls)).not.toContain(
      "ar_dc_",
    );
  });

  it("returns an installation credential once after approval and denies replay", async () => {
    const consumeApprovedDeviceCode = vi
      .fn()
      .mockImplementationOnce(async (input) => ({
        status: "approved",
        projectId: PROJECT_ID,
        installationId: input.credential.installationId,
        credential: input.credential,
      }))
      .mockResolvedValueOnce({ status: "access_denied" });
    const app = createIngestApp(
      activationDependencies({
        deviceCodes: {
          issueDeviceCode: async () => undefined,
          consumeApprovedDeviceCode,
        },
      }),
    );

    const approved = await app.request(tokenRequest());
    const approvedBody = await approved.json();
    const replay = await app.request(tokenRequest());

    expect(approved.status).toBe(200);
    expect(approvedBody).toMatchObject({
      status: "approved",
      project_id: PROJECT_ID,
      installation_id: expect.stringMatching(/^inst_[a-f0-9-]+$/),
      credential: expect.stringMatching(/^ar_inst_[A-Za-z0-9_-]{43}$/),
    });
    expect(consumeApprovedDeviceCode).toHaveBeenCalledWith(
      expect.objectContaining({
        credential: expect.objectContaining({
          raw: approvedBody.credential,
          prefix: expect.stringMatching(/^ar_inst_/),
          digest: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(replay.status).toBe(403);
    await expect(replay.json()).resolves.toEqual({
      status: "access_denied",
      request_id: "req_test",
    });
  });
});
