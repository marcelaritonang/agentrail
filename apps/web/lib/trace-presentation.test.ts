import { describe, expect, it } from "vitest";

import type { TraceDetail, TraceListItem, TraceSpan } from "./trace-read-model";
import {
  humanizeName,
  orderTraceSpans,
  presentRun,
  presentTraceDetail,
} from "./trace-presentation";

const STARTED_AT = "2026-07-23T08:00:00.000Z";

function traceFixture(overrides: Partial<TraceListItem> = {}): TraceListItem {
  return {
    traceId: "trace-abcdefghijkl",
    rootSpanId: "root",
    name: "sample.research-answer",
    agentId: "research-agent",
    onBehalfOf: "product-team",
    startedAt: STARTED_AT,
    endedAt: "2026-07-23T08:00:01.500Z",
    durationMs: 1_500,
    outcome: "ok",
    completionState: "complete",
    totalCostUsd: "0.015",
    pricingUnknown: false,
    spanCount: 4,
    ...overrides,
  };
}

function spanFixture(
  overrides: Partial<TraceSpan> & { spanId: string },
): TraceSpan {
  return {
    projectId: "project-a",
    traceId: "trace-abcdefghijkl",
    parentSpanId: "root",
    kind: "custom",
    name: overrides.spanId,
    agentId: "research-agent",
    onBehalfOf: null,
    startedAt: "2026-07-23T08:00:00.100Z",
    endedAt: "2026-07-23T08:00:00.200Z",
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
    ...overrides,
  };
}

function detailFixture(overrides: Partial<TraceDetail> = {}): TraceDetail {
  const root = spanFixture({
    spanId: "root",
    parentSpanId: null,
    kind: "trace",
    name: "sample.research-answer",
    startedAt: STARTED_AT,
    endedAt: "2026-07-23T08:00:01.500Z",
  });
  return {
    ...traceFixture(),
    spans: [
      root,
      spanFixture({
        spanId: "retrieval",
        kind: "retrieval",
        name: "find.sources",
      }),
      spanFixture({
        spanId: "model",
        kind: "llm",
        name: "draft.answer",
        startedAt: "2026-07-23T08:00:00.300Z",
        endedAt: "2026-07-23T08:00:00.800Z",
      }),
      spanFixture({
        spanId: "action",
        kind: "action",
        name: "publish.answer",
        agentId: "publisher-agent",
        startedAt: "2026-07-23T08:00:00.900Z",
        endedAt: "2026-07-23T08:00:01.200Z",
        hasPayload: true,
      }),
    ],
    ...overrides,
  };
}

describe("trace presentation", () => {
  it("humanizes a technical name and uses its fallback when no words remain", () => {
    expect(humanizeName("research.answer-v2", "Unnamed agent run")).toBe(
      "Research answer v2",
    );
    expect(humanizeName("._-", "Unnamed agent run")).toBe("Unnamed agent run");
  });

  it("presents a root-aware read-only successful run", () => {
    expect(
      presentRun(traceFixture({ rootSpanId: "root", spanCount: 4 }), {
        isReadOnlyExample: true,
      }),
    ).toMatchObject({
      displayTitle: "Research answer",
      technicalName: "sample.research-answer",
      outcomeLabel: "Succeeded",
      stepCount: 3,
      technicalSpanCount: 4,
      isReadOnlyExample: true,
    });
  });

  it("keeps every span as a step when no root boundary is recorded", () => {
    expect(
      presentRun(
        traceFixture({
          rootSpanId: null,
          spanCount: 2,
          pricingUnknown: true,
          totalCostUsd: null,
        }),
      ),
    ).toMatchObject({
      stepCount: 2,
      modelCostLabel: "Price unavailable",
      modelCostTechnicalLabel: "UNPRICED",
    });
  });

  it("maps failed and unavailable run outcomes without inferring completion", () => {
    expect(presentRun(traceFixture({ outcome: "error" })).outcomeLabel).toBe(
      "Failed",
    );
    expect(
      presentRun(
        traceFixture({
          outcome: null,
          completionState: null,
          endedAt: null,
          durationMs: null,
        }),
      ),
    ).toMatchObject({
      outcomeLabel: null,
      completionLabel: null,
      completionExplanation: null,
      durationLabel: "—",
    });
  });

  it("describes an incomplete recording only from recorded facts", () => {
    const presentation = presentTraceDetail(
      detailFixture({
        durationMs: null,
        endedAt: null,
        completionState: "incomplete",
      }),
    );

    expect(presentation).toMatchObject({
      completionLabel: "Incomplete recording",
      completionExplanation:
        "No completion envelope was recorded within 15 minutes.",
    });
    expect(presentation.summary).toBe(
      "This recording is incomplete. 3 steps were recorded. The final duration is unavailable. The agent performed 1 external action.",
    );
    expect(presentation.summary.toLowerCase()).not.toMatch(
      /result|purpose|because/,
    );
  });

  it("separates the root boundary and projects operational step categories", () => {
    const presentation = presentTraceDetail(detailFixture());

    expect(presentation.rootBoundary).toMatchObject({
      spanId: "root",
      ordinal: null,
      isRootBoundary: true,
      categoryLabel: "Recorded the complete run",
    });
    expect(presentation.steps.map((step) => step.categoryLabel)).toEqual([
      "Looked up data",
      "Called an AI model",
      "Performed an external action",
    ]);
    expect(presentation.steps.map((step) => step.ordinal)).toEqual([1, 2, 3]);
  });

  it("labels tool and custom spans and counts tools as external actions", () => {
    const presentation = presentTraceDetail(
      detailFixture({
        spanCount: 3,
        spans: [
          spanFixture({
            spanId: "root",
            parentSpanId: null,
            kind: "trace",
            startedAt: STARTED_AT,
          }),
          spanFixture({
            spanId: "tool",
            kind: "tool",
            startedAt: "2026-07-23T08:00:00.100Z",
          }),
          spanFixture({
            spanId: "custom",
            kind: "custom",
            startedAt: "2026-07-23T08:00:00.200Z",
          }),
        ],
      }),
    );

    expect(presentation.steps.map((step) => step.categoryLabel)).toEqual([
      "Called a tool",
      "Recorded a custom step",
    ]);
    expect(presentation.externalActionCount).toBe(1);
  });

  it("counts unique agents across the trace and recorded spans", () => {
    expect(
      presentTraceDetail(
        detailFixture({
          agentId: "orchestrator-agent",
          spans: [
            spanFixture({
              spanId: "root",
              parentSpanId: null,
              kind: "trace",
              agentId: "research-agent",
              startedAt: STARTED_AT,
            }),
            spanFixture({ spanId: "first", agentId: "research-agent" }),
            spanFixture({ spanId: "second", agentId: "publisher-agent" }),
          ],
        }),
      ).agentCount,
    ).toBe(3);
  });

  it("orders siblings by start time then span id with cycle and orphan protection", () => {
    const ordered = orderTraceSpans([
      spanFixture({
        spanId: "child-b",
        parentSpanId: "root",
        startedAt: "2026-07-23T08:00:00.200Z",
      }),
      spanFixture({
        spanId: "root",
        parentSpanId: null,
        startedAt: STARTED_AT,
      }),
      spanFixture({
        spanId: "child-a",
        parentSpanId: "root",
        startedAt: "2026-07-23T08:00:00.200Z",
      }),
      spanFixture({ spanId: "orphan", parentSpanId: "missing" }),
      spanFixture({ spanId: "cycle-a", parentSpanId: "cycle-b" }),
      spanFixture({ spanId: "cycle-b", parentSpanId: "cycle-a" }),
    ]);

    expect(ordered.map((span) => span.spanId)).toEqual([
      "root",
      "child-a",
      "child-b",
      "orphan",
      "cycle-a",
      "cycle-b",
    ]);
  });
});
