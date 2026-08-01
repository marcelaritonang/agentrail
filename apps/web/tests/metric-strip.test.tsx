// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MetricStrip } from "../components/product/metric-strip";
import type { UserOverview } from "../lib/product-read-model";

afterEach(() => {
  cleanup();
});

describe("MetricStrip", () => {
  it("labels context reduction as an estimate with its heuristic source", () => {
    const overview: UserOverview = {
      packs7d: 1,
      packs30d: 2,
      contextReductionEstimate30d: 75,
      reuseRate30d: 0.5,
      connectedClients: 1,
      staleDecisions: 0,
      latestError: null,
      nextAction: null,
    };

    render(<MetricStrip overview={overview} />);

    expect(screen.getByText("Estimated context reduction")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Based on local heuristic token estimates from accepted Context Pack events.",
      ),
    ).toBeInTheDocument();
  });
});
