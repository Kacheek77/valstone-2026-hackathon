import { DEFAULT_PRICES } from "./pricing";
import { getSupabase } from "./supabase";
import type { Account, Opportunity, OutreachStep, Rep, Settings, Signal } from "./types";

export type AllData = {
  reps: Rep[];
  accounts: Account[];
  signals: Signal[];
  opps: Opportunity[];
  steps: OutreachStep[];
  settings: Settings;
};

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

// VS-10: customer status is derived, not read from the seed column. An account
// is a Customer if it owns any FieldSense module or has a won opportunity;
// otherwise a Prospect. Every badge, filter, map pin and Claude prompt uses this.
export function derivedStatus(account: Pick<Account, "id" | "modules_owned">, wonAccountIds: Set<string>): Account["customer_status"] {
  return account.modules_owned.length > 0 || wonAccountIds.has(account.id) ? "Customer" : "Prospect";
}

// For code paths that load one account on its own (scoring, rewrites, sequences).
export async function withDerivedStatus(account: Account): Promise<Account> {
  const { data } = await getSupabase().from("opportunities").select("id").eq("account_id", account.id).eq("stage", "won").limit(1);
  const won = new Set(data && data.length ? [account.id] : []);
  return { ...account, customer_status: derivedStatus(account, won) };
}

// VS-10: signals Reset demo could not delete are moved to this week and
// ignored everywhere (the app's anon role may not delete signals).
export const RETIRED_WEEK = "1970-01-05";

// The demo dataset is small (tens of rows per table), so every page loads it
// whole and computes in memory. Fewer queries, fewer ways to fail.
export async function loadAll(): Promise<Loaded<AllData>> {
  try {
    const db = getSupabase();
    const [reps, accounts, signals, opps, settings, steps] = await Promise.all([
      db.from("reps").select("*").order("id"),
      db.from("accounts").select("*").order("name"),
      db.from("signals").select("*").order("week_of", { ascending: false }).order("id"),
      db.from("opportunities").select("*").order("id"),
      db.from("settings").select("*").eq("id", 1).maybeSingle(),
      db.from("outreach_steps").select("*").order("day"),
    ]);
    const failed = [reps, accounts, signals, opps, settings].find((r) => r.error);
    if (failed?.error) {
      return { ok: false, error: `The database could not be read (${failed.error.message}).` };
    }
    return {
      ok: true,
      data: {
        reps: reps.data as Rep[],
        accounts: (() => {
          const won = new Set((opps.data as Opportunity[]).filter((o) => o.stage === "won").map((o) => o.account_id));
          return (accounts.data as Account[]).map((a) => ({ ...a, customer_status: derivedStatus(a, won) }));
        })(),
        signals: (signals.data as Signal[]).filter((s) => s.week_of > "2000-01-01"),
        opps: opps.data as Opportunity[],
        // Sequences are an add-on: if the table is missing (VS-7 migration not
        // run yet), the rest of the app still works without them.
        steps: steps.error ? [] : (steps.data as OutreachStep[]),
        settings: { price_list: (settings.data as Settings | null)?.price_list ?? DEFAULT_PRICES },
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: `The database could not be reached (${e instanceof Error ? e.message : String(e)}).`,
    };
  }
}

// "This week" is the seven days ending at the newest signal's week_of, so a
// live USDM signal dated a day earlier than the seeded week still counts.
export function currentWeek(signals: Signal[]): string | null {
  return signals.reduce<string | null>((max, s) => (max && max > s.week_of ? max : s.week_of), null);
}

export function inWeek(weekOf: string, current: string | null): boolean {
  if (!current) return false;
  const diff = (Date.parse(current) - Date.parse(weekOf)) / 86_400_000;
  return diff >= 0 && diff < 7;
}
