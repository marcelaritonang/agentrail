import { PRICING_CATALOG, PRICING_CATALOG_VERSION } from "./catalog.js";

const NANO_USD_PER_USD = 100_000_000n;

export type PricingResult = {
  costUsd: string | null;
  pricingUnknown: boolean;
  catalogVersion: string;
};

function formatNanoUsd(value: bigint): string {
  const dollars = value / NANO_USD_PER_USD;
  const fraction = value % NANO_USD_PER_USD;

  return `${dollars}.${fraction.toString().padStart(8, "0")}`;
}

export function calculateCost(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): PricingResult {
  const price = PRICING_CATALOG.get(input.model);

  if (price === undefined) {
    return {
      costUsd: null,
      pricingUnknown: true,
      catalogVersion: PRICING_CATALOG_VERSION,
    };
  }

  const costNanoUsd =
    BigInt(input.inputTokens) * price.inputNanoUsdPerToken +
    BigInt(input.outputTokens) * price.outputNanoUsdPerToken;

  return {
    costUsd: formatNanoUsd(costNanoUsd),
    pricingUnknown: false,
    catalogVersion: PRICING_CATALOG_VERSION,
  };
}
