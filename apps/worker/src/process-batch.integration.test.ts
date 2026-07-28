import { describe, expect, it } from "vitest";

import { MemoryBlobStore } from "@agentrail-sdk/blob";
import type { CanonicalSpanBatch } from "@agentrail-sdk/contracts";
import type { SpanWrite } from "@agentrail-sdk/db";
import { processBatch, type WorkerRepository } from "./process-batch.js";

const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const KNOWN_SPAN = "b7ad6b7169203331";
const UNKNOWN_SPAN = "b7ad6b7169203332";

class RecordingBlobStore extends MemoryBlobStore {
  puts = 0;

  override async put(input: Parameters<MemoryBlobStore["put"]>[0]) {
    this.puts += 1;
    return super.put(input);
  }
}

class MemoryWorkerRepository implements WorkerRepository {
  readonly spans = new Map<string, SpanWrite>();
  totalCostUsd: string | null = "0.00000000";
  pricingUnknown = false;

  async getProject() {
    return { projectId: PROJECT_ID, payloadMode: "redacted" as const };
  }

  async getSpan(_projectId: string, spanId: string) {
    return this.spans.get(spanId) ?? null;
  }

  async insertSpan(input: SpanWrite) {
    if (this.spans.has(input.spanId)) return "duplicate" as const;
    this.spans.set(input.spanId, input);
    return "inserted" as const;
  }

  async recomputeTrace() {
    const values = [...this.spans.values()];
    this.pricingUnknown = values.some((span) => span.pricingUnknown);
    this.totalCostUsd = this.pricingUnknown
      ? null
      : values
          .reduce((total, span) => total + Number(span.costUsd ?? 0), 0)
          .toFixed(8);
  }

  async markIncompleteBefore() {
    return 0;
  }
}

function batch(): CanonicalSpanBatch {
  const common = {
    schema_version: 1 as const,
    project_id: PROJECT_ID,
    trace_id: TRACE_ID,
    parent_span_id: null,
    trace_name: "research.answer",
    kind: "llm" as const,
    agent_id: "research-agent",
    on_behalf_of: "user_42",
    started_at: "2026-07-21T10:00:00.000Z",
    ended_at: "2026-07-21T10:00:01.000Z",
    outcome: "ok" as const,
    attributes: {},
    payload: { authorization: "Bearer secret", query: "safe" },
  };
  return {
    spans: [
      {
        ...common,
        span_id: KNOWN_SPAN,
        name: "known",
        model: "test.known",
        input_tokens: 1_000,
        output_tokens: 500,
      },
      {
        ...common,
        span_id: UNKNOWN_SPAN,
        name: "unknown",
        model: "vendor.unknown",
        input_tokens: 50,
        output_tokens: 20,
      },
    ],
  };
}

describe("processBatch", () => {
  it("prices in the worker and ignores duplicate span delivery", async () => {
    const repository = new MemoryWorkerRepository();
    const blob = new RecordingBlobStore();

    await processBatch({ repository, blob }, batch());
    await processBatch({ repository, blob }, batch());

    expect(repository.spans.size).toBe(2);
    expect(repository.spans.get(KNOWN_SPAN)).toMatchObject({
      costUsd: "0.00400000",
      pricingUnknown: false,
    });
    expect(repository.spans.get(UNKNOWN_SPAN)).toMatchObject({
      costUsd: null,
      pricingUnknown: true,
    });
    expect(repository.totalCostUsd).toBeNull();
    expect(repository.pricingUnknown).toBe(true);
    expect(blob.puts).toBe(2);

    const stored = await blob.get(
      `payload/${PROJECT_ID}/${TRACE_ID}/${KNOWN_SPAN}.json`,
    );
    expect(JSON.parse(new TextDecoder().decode(stored))).toMatchObject({
      authorization: "[REDACTED]",
      query: "safe",
    });
  });
});
