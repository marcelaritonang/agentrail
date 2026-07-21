// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TraceHeader } from "../components/trace-header";
import type { TraceDetail } from "../lib/trace-read-model";

afterEach(cleanup);

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
    spanCount: 3,
    spans: [],
    ...input,
  };
}

describe("TraceHeader", () => {
  it("renders no running synonym before the incomplete timeout", () => {
    render(
      <TraceHeader
        trace={traceFixture({
          completionState: null,
          endedAt: null,
          durationMs: null,
        })}
      />,
    );

    expect(screen.queryByText(/running|pending|live/i)).not.toBeInTheDocument();
    expect(screen.queryByText("INCOMPLETE")).not.toBeInTheDocument();
  });

  it("renders INCOMPLETE only for timed-out traces", () => {
    render(
      <TraceHeader trace={traceFixture({ completionState: "incomplete" })} />,
    );

    expect(screen.getByText("INCOMPLETE")).toBeInTheDocument();
  });

  it("shows inherited actor context and never prices an unknown model as zero", () => {
    render(
      <TraceHeader
        trace={traceFixture({ totalCostUsd: null, pricingUnknown: true })}
      />,
    );

    expect(screen.getByText("research-agent")).toBeInTheDocument();
    expect(screen.getByText("sample-user")).toBeInTheDocument();
    expect(screen.getByText("UNPRICED")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });
});
