// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TraceRail } from "../components/trace-rail";
import type { TraceDetail, TraceSpan } from "../lib/trace-read-model";

afterEach(cleanup);

function traceSpan(
  input: Partial<TraceSpan> & Pick<TraceSpan, "spanId" | "name">,
): TraceSpan {
  return {
    projectId: "project-a",
    traceId: "trace-a",
    parentSpanId: null,
    kind: "custom",
    agentId: "research-agent",
    onBehalfOf: null,
    startedAt: "2026-07-21T10:00:00.000Z",
    endedAt: "2026-07-21T10:00:01.000Z",
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

const trace: TraceDetail = {
  traceId: "trace-a",
  rootSpanId: "root",
  name: "sample.research-answer",
  agentId: "orchestrator",
  onBehalfOf: "sample-user",
  startedAt: "2026-07-21T10:00:00.000Z",
  endedAt: "2026-07-21T10:00:01.000Z",
  durationMs: 1_000,
  outcome: "ok",
  completionState: "complete",
  totalCostUsd: "0.00400000",
  pricingUnknown: false,
  spanCount: 2,
  spans: [
    traceSpan({
      spanId: "root",
      name: "sample.research-answer",
      kind: "trace",
    }),
    traceSpan({
      spanId: "llm-child",
      parentSpanId: "root",
      name: "model.generate",
      kind: "llm",
      agentId: "writer-agent",
      startedAt: "2026-07-21T10:00:00.250Z",
      endedAt: "2026-07-21T10:00:00.500Z",
      hasPayload: true,
    }),
  ],
};

describe("TraceRail", () => {
  it("keeps rows static while exposing only payload-aware recorded data actions", () => {
    render(<TraceRail trace={trace} />);

    expect(
      screen.getByRole("heading", { name: "Technical timeline" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Exact order, nesting, and duration of 2 recorded spans",
      ),
    ).toBeVisible();
    const child = screen
      .getAllByRole("listitem")
      .find((row) => row.textContent?.includes("model.generate"));
    expect(child).toBeDefined();
    expect(child).toHaveTextContent("LLM");
    expect(child).toHaveTextContent("writer-agent");
    expect(child).toHaveTextContent("250 ms");
    expect(
      within(child!).getByRole("link", { name: "Inspect recorded data" }),
    ).toHaveAttribute("href", "/traces/trace-a?span=llm-child");
    const root = screen
      .getAllByRole("listitem")
      .find((row) => row.textContent?.includes("sample.research-answer"));
    expect(root).toBeDefined();
    expect(within(root!).getByText("Metadata only")).toBeVisible();
    expect(within(root!).queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the visual timing bar hidden from assistive technology", () => {
    const { container } = render(<TraceRail trace={trace} />);
    expect(
      container.querySelectorAll('.span-rail-visual[aria-hidden="true"]'),
    ).toHaveLength(2);
  });
});
