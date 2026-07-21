// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TraceTable } from "../components/trace-table";
import type { TracePage } from "../lib/trace-read-model";

function tracePageFixture(pricingUnknown = true): TracePage {
  return {
    page: 1,
    pageSize: 25,
    total: 1,
    items: [
      {
        traceId: "0af7651916cd43dd8448eb211c80319c",
        name: "sample.research-answer",
        agentId: "research-agent",
        onBehalfOf: "sample-user",
        startedAt: "2026-07-21T10:00:00.000Z",
        endedAt: "2026-07-21T10:00:01.250Z",
        durationMs: 1_250,
        outcome: "ok",
        completionState: null,
        totalCostUsd: pricingUnknown ? null : "0.00400000",
        pricingUnknown,
        spanCount: 3,
      },
    ],
  };
}

describe("TraceTable", () => {
  it("renders an accessible trace table with UNPRICED state", () => {
    render(<TraceTable page={tracePageFixture()} queryString="" />);

    const table = screen.getByRole("table", { name: /agent traces/i });
    expect(
      within(table).getByRole("columnheader", { name: /actor/i }),
    ).toBeInTheDocument();
    expect(within(table).getByText("UNPRICED")).toBeInTheDocument();
    expect(screen.queryByText(/running/i)).not.toBeInTheDocument();
  });

  it("links the persisted trace name to its detail route", () => {
    render(
      <TraceTable page={tracePageFixture(false)} queryString="q=sample" />,
    );

    expect(
      screen.getAllByRole("link", { name: "sample.research-answer" })[0],
    ).toHaveAttribute("href", "/traces/0af7651916cd43dd8448eb211c80319c");
    expect(screen.getAllByText("$0.0040").length).toBeGreaterThan(0);
  });
});
