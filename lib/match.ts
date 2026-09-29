import { MODULES, TYPE_MODULE, type Account, type Module, type Signal } from "./types";

// Hand-kept adjacency for the seeded counties only ("County, ST"). Used for
// drought signals, which spread across county lines; rain and heat stay local.
const ADJACENT: Record<string, string[]> = {
  "Finney, KS": ["Kearny, KS", "Haskell, KS", "Grant, KS"],
  "Kearny, KS": ["Finney, KS", "Grant, KS"],
  "Grant, KS": ["Kearny, KS", "Finney, KS", "Haskell, KS"],
  "Haskell, KS": ["Finney, KS", "Grant, KS", "Seward, KS"],
  "Seward, KS": ["Haskell, KS", "Texas, OK"],
  "Texas, OK": ["Cimarron, OK", "Seward, KS"],
  "Cimarron, OK": ["Texas, OK"],
  "Deaf Smith, TX": ["Parmer, TX"],
  "Parmer, TX": ["Deaf Smith, TX"],
  "Keith, NE": ["Perkins, NE", "Lincoln, NE"],
  "Lincoln, NE": ["Keith, NE", "Dawson, NE", "Perkins, NE"],
  "Kingfisher, OK": ["Canadian, OK", "Logan, OK", "Garfield, OK"],
  "Grady, OK": ["Canadian, OK", "Caddo, OK"],
  "Lubbock, TX": ["Hale, TX", "Hockley, TX", "Lynn, TX", "Crosby, TX", "Lamb, TX"],
};

const DRY_CROPS = ["corn", "sorghum", "wheat", "soy"];

function cropRelevant(account: Account, signal: Signal): boolean {
  if (signal.type === "rain") return true;
  return account.crops.some((c) =>
    DRY_CROPS.some((d) => c.toLowerCase().startsWith(d)),
  );
}

// The signal type's module first, then the other two in list order; the first
// one the account does not own. Null when it owns all three.
export function leadWithFor(account: Account, signal: Signal): Module | null {
  const first = TYPE_MODULE[signal.type];
  const order = [first, ...MODULES.filter((m) => m !== first)];
  return order.find((m) => !account.modules_owned.includes(m)) ?? null;
}

export type Match = { account: Account; leadWith: Module };

export function matchAccounts(signal: Signal, accounts: Account[]): Match[] {
  const key = `${signal.county}, ${signal.state}`;
  const counties = new Set([key]);
  if (signal.type === "drought") {
    for (const c of ADJACENT[key] ?? []) counties.add(c);
  }

  const matches: Match[] = [];
  for (const account of accounts) {
    if (!counties.has(`${account.county}, ${account.state}`)) continue;
    if (!cropRelevant(account, signal)) continue;
    const leadWith = leadWithFor(account, signal);
    if (!leadWith) continue;
    matches.push({ account, leadWith });
  }
  return matches;
}
