import { describe, expect, it } from "vitest";

import { calculateCost } from "./calculate-cost.js";

describe("calculateCost", () => {
  it("calculates known-model input and output cost", () => {
    expect(
      calculateCost({
        model: "test.known",
        inputTokens: 1_000,
        outputTokens: 500,
      }),
    ).toEqual({
      costUsd: "0.00400000",
      pricingUnknown: false,
      catalogVersion: "2026-07-21",
    });
  });

  it("keeps unknown pricing nullable", () => {
    expect(
      calculateCost({
        model: "vendor.unknown",
        inputTokens: 50,
        outputTokens: 20,
      }),
    ).toEqual({
      costUsd: null,
      pricingUnknown: true,
      catalogVersion: "2026-07-21",
    });
  });
});
