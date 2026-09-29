import { DEFAULT_PRICES } from "./pricing";
import { getSupabase } from "./supabase";
import type { Account, Opportunity, Rep, Settings, Signal } from "./types";

export type AllData = {
  reps: Rep[];
  accounts: Account[];
  signals: Signal[];
  opps: Opportunity[];
  settings: Settings;
};

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

// The demo dataset is small (tens of rows per table), so every page loads it
// whole and computes in memory. Fewer queries, fewer ways to fail.
export async function loadAll(): Promise<Loaded<AllData>> {
  try {
    const db = getSupabase();
    const [reps, accounts, signals, opps, settings] = await Promise.all([
      db.from("reps").select("*").order("id"),
      db.from("accounts").select("*").order("name"),
      db.from("signals").select("*").order("week_of", { ascending: false }).order("created_at"),
      db.from("opportunities").select("*").order("created_at"),
      db.from("settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    const failed = [reps, accounts, signals, opps, settings].find((r) => r.error);
    if (failed?.error) {
      return { ok: false, error: `The database could not be read (${failed.error.message}).` };
    }
    return {
      ok: true,
      data: {
        reps: reps.data as Rep[],
        accounts: accounts.data as Account[],
        signals: signals.data as Signal[],
        opps: opps.data as Opportunity[],
        settings: (settings.data as Settings | null) ?? {
          price_list: DEFAULT_PRICES,
          weekly_history: {},
        },
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

export function expectedValue(opps: Opportunity[]): number {
  return opps.reduce((sum, o) => sum + (o.amount * o.score) / 100, 0);
}
