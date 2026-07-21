import { describe, expect, it, vi } from "vitest";

import type { SpanEnvelope } from "@agentrail/contracts";
import { AgentRail } from "./agentrail.js";
import {
  BufferedDelivery,
  HttpSpanTransport,
  type SpanTransport,
} from "./delivery.js";

function spanFixture(spanId = "b7ad6b7169203331"): SpanEnvelope {
  return {
    schema_version: 1,
    trace_id: "0af7651916cd43dd8448eb211c80319c",
    span_id: spanId,
    parent_span_id: null,
    trace_name: "research.answer",
    kind: "trace",
    name: "research.answer",
    agent_id: "research-agent",
    on_behalf_of: "user_42",
    started_at: "2026-07-21T10:00:00.000Z",
    ended_at: "2026-07-21T10:00:01.000Z",
    outcome: "ok",
    attributes: {},
  };
}

class RecordingTransport implements SpanTransport {
  readonly batches: SpanEnvelope[][] = [];

  async send(spans: SpanEnvelope[]): Promise<void> {
    this.batches.push(spans);
  }
}

describe("BufferedDelivery", () => {
  it("flushes pending spans during shutdown", async () => {
    const transport = new RecordingTransport();
    const delivery = new BufferedDelivery({
      transport,
      batchSize: 10,
      maxBuffer: 100,
      flushIntervalMs: 60_000,
    });
    delivery.add(spanFixture());

    await expect(delivery.shutdown({ timeoutMs: 1_000 })).resolves.toEqual({
      delivered: 1,
      dropped: 0,
      pending: 0,
    });
    expect(transport.batches).toEqual([[spanFixture()]]);
  });

  it("drops the newest span through onDrop when the bounded buffer is full", () => {
    const dropped: SpanEnvelope[] = [];
    const delivery = new BufferedDelivery({
      transport: new RecordingTransport(),
      maxBuffer: 1,
      batchSize: 10,
      flushIntervalMs: 60_000,
      onDrop: (span) => dropped.push(span),
    });
    delivery.add(spanFixture("0000000000000001"));
    delivery.add(spanFixture("0000000000000002"));

    expect(dropped.map((span) => span.span_id)).toEqual(["0000000000000002"]);
  });

  it("is exposed through AgentRail.shutdown", async () => {
    const shutdown = vi.fn(async () => ({
      delivered: 0,
      dropped: 0,
      pending: 0,
    }));
    const rail = new AgentRail({
      actor: { agentId: "planner" },
      sink: { add: () => undefined, shutdown },
    });

    await expect(rail.shutdown({ timeoutMs: 321 })).resolves.toEqual({
      delivered: 0,
      dropped: 0,
      pending: 0,
    });
    expect(shutdown).toHaveBeenCalledWith({ timeoutMs: 321 });
  });
});

describe("HttpSpanTransport", () => {
  it("retries 429, honors Retry-After, and accepts the next 202", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { "Retry-After": "2" } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const sleep = vi.fn(async () => undefined);
    const transport = new HttpSpanTransport({
      endpoint: "https://ingest.agentrail.dev/v1/spans",
      apiKey: "ar_live_secret",
      fetch,
      sleep,
      random: () => 0,
    });

    await transport.send([spanFixture()]);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer ar_live_secret",
    });
  });

  it("does not retry a non-retryable authentication response", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    const sleep = vi.fn(async () => undefined);
    const transport = new HttpSpanTransport({
      endpoint: "https://ingest.agentrail.dev/v1/spans",
      apiKey: "ar_live_secret",
      fetch,
      sleep,
    });

    await expect(transport.send([spanFixture()])).rejects.toMatchObject({
      status: 401,
      retryable: false,
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });
});
