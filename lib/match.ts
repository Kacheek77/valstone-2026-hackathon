import { MODULES, TYPE_MODULE, type Account, type Module, type Rep, type Signal } from "./types";

const DRY_CROPS = ["corn", "sorghum", "wheat", "soy"];

function cropRelevant(account: Account, signal: Signal): boolean {
  if (signal.type === "rain") return true;
  return account.crops.some((c) =>
    DRY_CROPS.some((d) => c.toLowerCase().startsWith(d)),
  );
}

function targetModule(signal: Signal): Module {
  const t = signal.target_module as Module;
  return MODULES.includes(t) ? t : TYPE_MODULE[signal.type];
}

// The signal's target module first, then the other two in list order; the
// first one the account does not own. Null when it owns all three.
export function leadWithFor(account: Account, signal: Signal): Module | null {
  const first = targetModule(signal);
  const order = [first, ...MODULES.filter((m) => m !== first)];
  return order.find((m) => !account.modules_owned.includes(m)) ?? null;
}

export type Match = { account: Account; leadWith: Module };

// Deterministic. Accounts in the signal's county; for drought, every county in
// the same territory counts as adjacent. Then crop relevance and module gap.
export function matchAccounts(signal: Signal, accounts: Account[], reps: Rep[]): Match[] {
  const key = `${signal.county}, ${signal.state}`;
  const counties = new Set([key]);
  if (signal.type === "drought") {
    const territory = reps.find((r) => r.counties.includes(key));
    for (const c of territory?.counties ?? []) counties.add(c);
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
