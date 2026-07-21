import { describe, expect, it } from "vitest";

import { formatCost, formatDuration, shortId } from "./format";

describe("dashboard formatters", () => {
  it("formats unknown cost as UNPRICED and known cost precisely", () => {
    expect(formatCost({ totalCostUsd: null, pricingUnknown: true })).toBe(
      "UNPRICED",
    );
    expect(
      formatCost({ totalCostUsd: "0.00400000", pricingUnknown: false }),
    ).toBe("$0.0040");
  });

  it("formats bounded duration and compact identifiers", () => {
    expect(formatDuration(1_250)).toBe("1.25 s");
    expect(shortId("0af7651916cd43dd8448eb211c80319c")).toBe("0af76519…319c");
  });
});
