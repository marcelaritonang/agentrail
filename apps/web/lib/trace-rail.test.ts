import { describe, expect, it } from "vitest";

import type { TraceSpan } from "./trace-read-model";
import { buildTraceRail } from "./trace-rail";

const ROOT = "root-span";
const CHILD = "child-span";

function span(
  input: Partial<TraceSpan> & {
    spanId: string;
    startMs: number;
    endMs: number;
  },
): TraceSpan {
  return {
    projectId: "project-a",
    traceId: "trace-a",
    parentSpanId: null,
    kind: "custom",
    name: input.spanId,
    agentId: "research-agent",
    onBehalfOf: null,
    outcome: "ok",
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    pricingUnknown: false,
    pricingCatalogVersion: null,
    attributes: {},
    payloadTruncated: false,
    hasPayload: false,
    ...input,
    startedAt: new Date(input.startMs).toISOString(),
    endedAt: new Date(input.endMs).toISOString(),
  };
}

describe("buildTraceRail", () => {
  it("maps child timing into stable bounded percentages", () => {
    const rows = buildTraceRail([
      span({ spanId: ROOT, kind: "trace", startMs: 0, endMs: 1_000 }),
      span({
        spanId: CHILD,
        parentSpanId: ROOT,
        kind: "llm",
        startMs: 250,
        endMs: 500,
      }),
    ]);

    expect(rows.find((row) => row.spanId === CHILD)).toMatchObject({
      offsetPercent: 25,
      widthPercent: 25,
      depth: 1,
      signal: "llm",
    });
  });

  it("uses a visible minimum width without exceeding the rail", () => {
    const [row] = buildTraceRail(
      [span({ spanId: CHILD, startMs: 999, endMs: 1_000 })],
      { traceStartMs: 0, traceEndMs: 1_000 },
    );

    expect(row?.widthPercent).toBeGreaterThanOrEqual(0.6);
    expect(
      (row?.offsetPercent ?? 0) + (row?.widthPercent ?? 0),
    ).toBeLessThanOrEqual(100);
  });

  it("orders siblings deterministically and terminates cyclic parents", () => {
    const rows = buildTraceRail([
      span({
        spanId: "child-b",
        parentSpanId: ROOT,
        startMs: 200,
        endMs: 400,
      }),
      span({ spanId: ROOT, kind: "trace", startMs: 0, endMs: 1_000 }),
      span({
        spanId: "child-a",
        parentSpanId: ROOT,
        startMs: 200,
        endMs: 300,
      }),
      span({
        spanId: "cycle-a",
        parentSpanId: "cycle-b",
        startMs: 500,
        endMs: 600,
      }),
      span({
        spanId: "cycle-b",
        parentSpanId: "cycle-a",
        startMs: 510,
        endMs: 590,
      }),
    ]);

    expect(rows.slice(0, 3).map((row) => row.spanId)).toEqual([
      ROOT,
      "child-a",
      "child-b",
    ]);
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.depth >= 0 && row.depth < rows.length)).toBe(
      true,
    );
  });

  it("uses error as the strongest signal", () => {
    const [row] = buildTraceRail([
      span({
        spanId: CHILD,
        kind: "retrieval",
        outcome: "error",
        startMs: 0,
        endMs: 10,
      }),
    ]);

    expect(row?.signal).toBe("error");
  });
});
