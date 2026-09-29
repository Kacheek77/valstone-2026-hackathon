import type { PriceList } from "./types";

export const DEFAULT_PRICES: PriceList = {
  "Irrigation Scheduling": 4.0,
  "Field-Work Planner": 2.5,
  "Yield & Insurance Records": 1.5,
  setup: 2500,
};

// Estimated first-year value: module rate per acre x acres, plus setup,
// rounded to the nearest $100.
export function amountFor(
  module: string,
  acres: number,
  prices: PriceList = DEFAULT_PRICES,
): number {
  const rate = prices[module as keyof PriceList] ?? 0;
  return Math.round((rate * acres + prices.setup) / 100) * 100;
}
