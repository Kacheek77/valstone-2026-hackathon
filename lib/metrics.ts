import type { AllData } from "./data";
import { median } from "./format";
import { matchAccounts } from "./match";
import { amountFor } from "./pricing";
import { ACTED_STAGES, OPEN_STAGES, type Module, type Opportunity, type Signal } from "./types";

// Score assumed for a matched account nobody has generated yet.
const UNGENERATED_SCORE = 50;

// VS-4b ruling (final): Option C. Matched-but-ungenerated accounts count as
// available only on signals the rep ignored entirely (zero opportunities), so
// ignoring a signal still costs capture rate, but a rep who acted on a signal
// is judged on the opportunities they generated. Counting every ungenerated
// match (VS-4a) flattened the deliberate performers in the seed.
const UNGENERATED_ONLY_WHEN_IGNORED = true;

export function expectedValue(opps: Opportunity[]): number {
  return opps.reduce((sum, o) => sum + (o.amount * o.score) / 100, 0);
}

export type SignalValue = { available: number; captured: number; generated: number; ungenerated: number };

// Available = Σ generated (amount × score/100) + Σ matched-but-ungenerated
// (amount at the signal's target module × 50/100). Captured = Σ generated
// that are pushed, sent or won.
export function signalValue(signal: Signal, data: AllData): SignalValue {
  const opps = data.opps.filter((o) => o.signal_id === signal.id);
  const generated = new Set(opps.map((o) => o.account_id));
  let available = expectedValue(opps);
  let ungenerated = 0;
  if (!(UNGENERATED_ONLY_WHEN_IGNORED && opps.length > 0)) {
    for (const m of matchAccounts(signal, data.accounts, data.reps)) {
      if (generated.has(m.account.id)) continue;
      ungenerated++;
      available +=
        (amountFor(signal.target_module as Module, m.account.acres, data.settings.price_list) * UNGENERATED_SCORE) / 100;
    }
  }
  const captured = expectedValue(opps.filter((o) => ACTED_STAGES.includes(o.stage)));
  return { available, captured, generated: opps.length, ungenerated };
}

export function sumValues(signals: Signal[], data: AllData): SignalValue {
  return signals.reduce<SignalValue>(
    (acc, s) => {
      const v = signalValue(s, data);
      return {
        available: acc.available + v.available,
        captured: acc.captured + v.captured,
        generated: acc.generated + v.generated,
        ungenerated: acc.ungenerated + v.ungenerated,
      };
    },
    { available: 0, captured: 0, generated: 0, ungenerated: 0 },
  );
}

export function captureRate(v: SignalValue): number | null {
  return v.available > 0 ? (v.captured / v.available) * 100 : null;
}

// Median hours from signal week_of to pushed_at, over every signal-driven
// opportunity the rep pushed (all weeks, so slow reps show even in a quiet week).
export function timeToAct(repId: string, data: AllData): number | null {
  const signalById = new Map(data.signals.map((s) => [s.id, s]));
  const hours = data.opps
    .filter((o) => o.rep_id === repId && o.pushed_at && o.signal_id)
    .map((o) => {
      const s = signalById.get(o.signal_id!);
      return s ? (Date.parse(o.pushed_at!) - Date.parse(`${s.week_of}T00:00:00Z`)) / 3_600_000 : null;
    })
    .filter((h): h is number => h !== null);
  return median(hours);
}

export function offTerritoryCount(repId: string, data: AllData): number {
  return data.opps.filter((o) => o.rep_id === repId && o.is_off_territory).length;
}

// Share of the rep's open pipeline dollars that came from a signal.
export function signalDrivenShare(repId: string, data: AllData): number | null {
  const open = data.opps.filter((o) => o.rep_id === repId && OPEN_STAGES.includes(o.stage));
  const total = open.reduce((s, o) => s + o.amount, 0);
  if (total === 0) return null;
  return (open.filter((o) => o.is_signal_driven).reduce((s, o) => s + o.amount, 0) / total) * 100;
}

// All distinct signal weeks, oldest first.
export function signalWeeks(signals: Signal[]): string[] {
  return [...new Set(signals.map((s) => s.week_of))].sort();
}
