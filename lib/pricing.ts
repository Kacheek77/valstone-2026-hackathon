import type { PriceList } from "./types";

export const DEFAULT_PRICES: PriceList = {
  "Irrigation Scheduling": 4.0,
  "Field-Work Planner": 2.5,
  "Yield & Insurance Records": 1.5,
  setup: 2500,
};

// VS-12 T4: the amount's calculation with this account's numbers, e.g.
// "$4.00/ac × 5,000 ac = $20,000 + $2,500 setup = $22,500 (rounded to $100). Irrigation Scheduling list price."
export function amountExplain(module: string, acres: number, prices: PriceList = DEFAULT_PRICES): string {
  const rate = prices[module as keyof PriceList] ?? 0;
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const base = rate * acres;
  return `$${rate.toFixed(2)}/ac × ${acres.toLocaleString("en-US")} ac = ${money(base)} + ${money(prices.setup)} setup = ${money(
    amountFor(module, acres, prices),
  )} (rounded to $100). ${module} list price.`;
}

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
