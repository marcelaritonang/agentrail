import { describe, expect, it, vi } from "vitest";

import {
  createDirectUsageEventQueue,
  createHostedIngestRequestHandler,
} from "../lib/hosted-ingest";

const usageBatch = {
  events: [
    {
      schema_version: 1,
      event_id: "evt_01",
      project_id: "00000000-0000-4000-8000-000000000001",
      installation_id: "inst_01",
      pack_id: "pack_01",
      event_type: "context_pack_created",
      occurred_at: "2026-07-30T08:00:00.000Z",
      received_at: "2026-07-30T08:00:01.000Z",
      safe_attributes: {
        client: "codex",
        package_version: "0.1.2",
        status: "ready",
        latency_ms: 123,
        candidate_tokens_estimate: 1_200,
        returned_tokens_estimate: 400,
        source_counts: { ts: 3 },
        warning_codes: [],
      },
    },
  ],
} as const;

describe("hosted ingest request handler", () => {
  it("passes /v1 requests through to the hosted ingest app", async () => {
    const app = {
      request: vi.fn(
        async (request: Request) =>
          Response.json({ path: new URL(request.url).pathname }),
      ),
    };
    const handler = createHostedIngestRequestHandler(async () => app);

    const response = await handler(
      new Request("https://agentrail.id/v1/device/code", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      path: "/v1/device/code",
    });
    expect(app.request).toHaveBeenCalledOnce();
  });

  it("returns a structured 503 instead of a 404 when hosted ingest is unavailable", async () => {
    const handler = createHostedIngestRequestHandler(async () => {
      throw new Error("missing DATABASE_URL");
    });

    const response = await handler(
      new Request("https://agentrail.id/v1/events", { method: "POST" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "service_unavailable",
        retryable: true,
      },
    });
  });
});

describe("direct usage event queue", () => {
  it("persists usage metrics through the control repository", async () => {
    const repository = {
      insertUsageEvent: vi.fn(async () => "inserted" as const),
      upsertContextPack: vi.fn(async () => undefined),
      markInstallationUsage: vi.fn(async () => undefined),
      incrementDailyUsage: vi.fn(async () => undefined),
    };
    const queue = createDirectUsageEventQueue(repository);

    const result = await queue.enqueue(usageBatch);

    expect(result.messageId).toMatch(/^direct_usage_1_0_/);
    expect(repository.insertUsageEvent).toHaveBeenCalledWith({
      projectId: "00000000-0000-4000-8000-000000000001",
      installationId: "inst_01",
      eventId: "evt_01",
      packId: "pack_01",
      eventType: "context_pack_created",
      occurredAt: new Date("2026-07-30T08:00:00.000Z"),
      safeAttributes: {
        client: "codex",
        packageVersion: "0.1.2",
        status: "ready",
        latencyMs: 123,
        candidateTokensEstimate: 1_200,
        returnedTokensEstimate: 400,
        sourceCounts: { ts: 3 },
        warningCodes: [],
      },
    });
    expect(repository.upsertContextPack).toHaveBeenCalledOnce();
    expect(repository.markInstallationUsage).toHaveBeenCalledOnce();
    expect(repository.incrementDailyUsage).toHaveBeenCalledWith({
      projectId: "00000000-0000-4000-8000-000000000001",
      day: "2026-07-30",
      eventType: "context_pack_created",
      candidateTokensEstimate: 1_200,
      returnedTokensEstimate: 400,
    });
  });

  it("does not update rollups for duplicate usage events", async () => {
    const repository = {
      insertUsageEvent: vi.fn(async () => "duplicate" as const),
      upsertContextPack: vi.fn(async () => undefined),
      markInstallationUsage: vi.fn(async () => undefined),
      incrementDailyUsage: vi.fn(async () => undefined),
    };
    const queue = createDirectUsageEventQueue(repository);

    const result = await queue.enqueue(usageBatch);

    expect(result.messageId).toMatch(/^direct_usage_0_1_/);
    expect(repository.upsertContextPack).not.toHaveBeenCalled();
    expect(repository.markInstallationUsage).not.toHaveBeenCalled();
    expect(repository.incrementDailyUsage).not.toHaveBeenCalled();
  });
});
