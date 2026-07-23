// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TraceHeader } from "../components/trace-header";
import { presentTraceDetail } from "../lib/trace-presentation";
import type { TraceDetail, TraceSpan } from "../lib/trace-read-model";

afterEach(cleanup);

function spanFixture(
  input: Partial<TraceSpan> & Pick<TraceSpan, "spanId" | "name">,
): TraceSpan {
  return {
    projectId: "project-a",
    traceId: "0af7651916cd43dd8448eb211c80319c",
    parentSpanId: "root-span",
    kind: "custom",
    agentId: "research-agent",
    onBehalfOf: null,
    startedAt: "2026-07-21T10:00:00.100Z",
    endedAt: "2026-07-21T10:00:00.200Z",
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
  };
}

function traceFixture(input: Partial<TraceDetail> = {}): TraceDetail {
  return {
    traceId: "0af7651916cd43dd8448eb211c80319c",
    rootSpanId: "root-span",
    name: "sample.research-answer",
    agentId: "research-agent",
    onBehalfOf: "sample-user",
    startedAt: "2026-07-21T10:00:00.000Z",
    endedAt: "2026-07-21T10:00:01.250Z",
    durationMs: 1_250,
    outcome: "ok",
    completionState: "complete",
    totalCostUsd: "0.00400000",
    pricingUnknown: false,
    spanCount: 4,
    spans: [
      spanFixture({
        spanId: "root-span",
        name: "sample.research-answer",
        parentSpanId: null,
        kind: "trace",
        startedAt: "2026-07-21T10:00:00.000Z",
        endedAt: "2026-07-21T10:00:01.250Z",
      }),
      spanFixture({
        spanId: "retrieval",
        name: "find.sources",
        kind: "retrieval",
      }),
      spanFixture({
        spanId: "model",
        name: "draft.answer",
        kind: "llm",
      }),
      spanFixture({
        spanId: "action",
        name: "publish.answer",
        kind: "action",
      }),
    ],
    ...input,
  };
}

function renderHeader(
  input: Partial<TraceDetail> = {},
  options: { isReadOnlyExample?: boolean } = {},
) {
  const trace = traceFixture(input);
  render(
    <TraceHeader
      trace={trace}
      presentation={presentTraceDetail(trace, options)}
    />,
  );
}

describe("TraceHeader", () => {
  it("leads with a readable factual summary and ordered at-a-glance facts", () => {
    renderHeader({}, { isReadOnlyExample: true });

    expect(
      screen.getByRole("link", { name: "Back to all agent runs" }),
    ).toHaveAttribute("href", "/traces");
    expect(
      screen.getByRole("heading", { name: "Research answer" }),
    ).toBeVisible();
    expect(screen.getByText("sample.research-answer")).toBeVisible();
    expect(screen.getByText(/3 steps were recorded in 1.25 s/)).toBeVisible();
    expect(screen.getByText("Succeeded")).toBeVisible();
    expect(screen.getByText("Requested by")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();

    const facts = screen.getByLabelText("At a glance");
    expect(
      within(facts)
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual([
      "Status",
      "Agent",
      "Requested by",
      "Duration",
      "Steps",
      "Model cost",
    ]);
  });

  it("states when no final outcome has been recorded without a status badge", () => {
    renderHeader({
      outcome: null,
      completionState: null,
      endedAt: null,
      durationMs: null,
    });

    expect(
      screen.getByText("No final outcome has been recorded yet."),
    ).toBeVisible();
    expect(screen.queryByText(/running/i)).not.toBeInTheDocument();
    expect(document.querySelector(".outcome")).not.toBeInTheDocument();
  });

  it("explains an incomplete recording with the configured timeout", () => {
    renderHeader({
      outcome: null,
      completionState: "incomplete",
      endedAt: null,
      durationMs: null,
    });

    expect(screen.getByText("Incomplete recording")).toBeVisible();
    expect(
      screen.getByText(
        "No completion envelope was recorded within 15 minutes.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/running/i)).not.toBeInTheDocument();
  });

  it("shows both readable and technical unknown-pricing labels", () => {
    renderHeader({ totalCostUsd: null, pricingUnknown: true });

    expect(screen.getByText("Price unavailable")).toBeVisible();
    expect(screen.getByText("UNPRICED")).toBeVisible();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });
});
