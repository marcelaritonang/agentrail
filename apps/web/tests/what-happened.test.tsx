// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TraceDetailError from "../app/(dashboard)/traces/[traceId]/error";
import TraceDetailLoading from "../app/(dashboard)/traces/[traceId]/loading";
import TraceNotFound from "../app/(dashboard)/traces/[traceId]/not-found";
import { WhatHappened } from "../components/what-happened";
import { presentTraceDetail } from "../lib/trace-presentation";
import type { TraceDetail, TraceSpan } from "../lib/trace-read-model";

afterEach(cleanup);

function spanFixture(
  input: Partial<TraceSpan> & Pick<TraceSpan, "spanId" | "name">,
): TraceSpan {
  return {
    projectId: "project-a",
    traceId: "trace-a",
    parentSpanId: "root",
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

function traceFixture(): TraceDetail {
  return {
    traceId: "trace-a",
    rootSpanId: "root",
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
        spanId: "root",
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
        startedAt: "2026-07-21T10:00:00.300Z",
        hasPayload: true,
      }),
      spanFixture({
        spanId: "action",
        name: "publish.answer",
        kind: "action",
        startedAt: "2026-07-21T10:00:00.500Z",
      }),
    ],
  };
}

describe("WhatHappened", () => {
  it("renders the root boundary once and every operational step once", () => {
    const trace = traceFixture();
    render(
      <WhatHappened trace={trace} presentation={presentTraceDetail(trace)} />,
    );

    const list = screen.getByRole("list", { name: "What happened" });
    expect(within(list).getByText("Looked up data")).toBeVisible();
    expect(within(list).getByText("Called an AI model")).toBeVisible();
    expect(
      within(list).getByText("Performed an external action"),
    ).toBeVisible();
    expect(within(list).getByText("Recorded the complete run")).toBeVisible();
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(within(list).getAllByText("find.sources")).toHaveLength(1);
    expect(within(list).getAllByText("draft.answer")).toHaveLength(1);
    expect(within(list).getAllByText("publish.answer")).toHaveLength(1);
    expect(
      within(list).getByRole("link", { name: "Inspect recorded data" }),
    ).toHaveAttribute("href", "/traces/trace-a?span=model");
    expect(within(list).getAllByText("Metadata only")).toHaveLength(2);
  });

  it("uses a neutral root-boundary label for an incomplete recording", () => {
    const trace = {
      ...traceFixture(),
      completionState: "incomplete" as const,
      endedAt: null,
      durationMs: null,
      outcome: null,
    };
    render(
      <WhatHappened trace={trace} presentation={presentTraceDetail(trace)} />,
    );

    const list = screen.getByRole("list", { name: "What happened" });
    expect(within(list).getByText("Recorded the run boundary")).toBeVisible();
    expect(
      within(list).queryByText("Recorded the complete run"),
    ).not.toBeInTheDocument();
  });

  it("uses a neutral root-boundary label before completion is recorded", () => {
    const trace = {
      ...traceFixture(),
      completionState: null,
      endedAt: null,
      durationMs: null,
      outcome: null,
    };
    render(
      <WhatHappened trace={trace} presentation={presentTraceDetail(trace)} />,
    );

    const list = screen.getByRole("list", { name: "What happened" });
    expect(within(list).getByText("Recorded the run boundary")).toBeVisible();
    expect(
      within(list).queryByText("Recorded the complete run"),
    ).not.toBeInTheDocument();
  });
});

describe("trace detail route states", () => {
  it("identifies the detail loading state in plain language", () => {
    render(<TraceDetailLoading />);

    expect(screen.getByText("Loading run details…")).toBeVisible();
  });

  it("offers a safe retry without disclosing the thrown error", () => {
    const reset = vi.fn();
    render(
      <TraceDetailError
        error={new Error("postgres://secret@database/private")}
        reset={reset}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "We couldn't load this agent run",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("The run detail read request failed."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/postgres:\/\/secret@database\/private/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("links a missing run back to the run index", () => {
    render(<TraceNotFound />);

    expect(
      screen.getByRole("heading", { name: "Run not found" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to all agent runs" }),
    ).toHaveAttribute("href", "/traces");
  });
});
