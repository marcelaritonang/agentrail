export const PRICING_CATALOG_VERSION = "2026-07-21";

export type ModelPrice = {
  inputNanoUsdPerToken: bigint;
  outputNanoUsdPerToken: bigint;
  source: string;
  effectiveDate: string;
};

export const PRICING_CATALOG: ReadonlyMap<string, ModelPrice> = new Map([
  [
    "test.known",
    {
      inputNanoUsdPerToken: 100n,
      outputNanoUsdPerToken: 600n,
      source: "AgentRail deterministic test fixture",
      effectiveDate: "2026-07-21",
    },
  ],
]);
