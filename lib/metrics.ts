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

// ungeneratedValue: the part of available that comes from matched accounts
// nobody has generated yet (score 50). VS-10 splits it out for Results.
export type SignalValue = { available: number; captured: number; generated: number; ungenerated: number; ungeneratedValue: number };

// Available = Σ generated (amount × score/100) + Σ matched-but-ungenerated
// (amount at the signal's target module × 50/100). Captured = Σ generated
// that are pushed, sent or won.
export function signalValue(signal: Signal, data: AllData): SignalValue {
  const opps = data.opps.filter((o) => o.signal_id === signal.id);
  const generated = new Set(opps.map((o) => o.account_id));
  let available = expectedValue(opps);
  let ungenerated = 0;
  let ungeneratedValue = 0;
  if (!(UNGENERATED_ONLY_WHEN_IGNORED && opps.length > 0)) {
    for (const m of matchAccounts(signal, data.accounts, data.reps)) {
      if (generated.has(m.account.id)) continue;
      ungenerated++;
      const v = (amountFor(signal.target_module as Module, m.account.acres, data.settings.price_list) * UNGENERATED_SCORE) / 100;
      ungeneratedValue += v;
      available += v;
    }
  }
  const captured = expectedValue(opps.filter((o) => ACTED_STAGES.includes(o.stage)));
  return { available, captured, generated: opps.length, ungenerated, ungeneratedValue };
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
        ungeneratedValue: acc.ungeneratedValue + v.ungeneratedValue,
      };
    },
    { available: 0, captured: 0, generated: 0, ungenerated: 0, ungeneratedValue: 0 },
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

// ---------------------------------------------------------------- results (VS-6)

// Draft or accepted opportunities older than this are counted as expired.
export const EXPIRE_DAYS = 21;

// "open" (VS-10): drafts and matched-but-ungenerated value younger than the
// expiry, i.e. current value nobody has worked yet. Not lost.
export type SegmentKey = "won" | "sentOpen" | "pushed" | "open";
export type Segment = { value: number; count: number; amount: number };

// Everything is in expected value (amount × score / 100), so the segments
// always fit inside "available". The gray remainder is available minus the
// four segments: lost deals, expired drafts and pushes, and matched accounts
// nobody generated.
export type Breakdown = {
  available: number;
  segments: Record<SegmentKey, Segment>;
  remainder: number;
  lost: { count: number; amount: number };
  expired: { count: number; amount: number };
  signals: number;
  wonPct: number | null;
};

// Monday of the week containing an ISO date or timestamp.
export function weekStart(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

// The week an opportunity belongs to: its signal's week, or for a
// list-prospected opportunity, the week it was created.
export function oppWeek(o: Opportunity, signalById: Map<string, Signal>): string {
  const s = o.signal_id ? signalById.get(o.signal_id) : undefined;
  return s ? s.week_of : weekStart(o.created_at);
}

function isExpired(o: Opportunity, now: number): boolean {
  return (o.stage === "draft" || o.stage === "pushed") && now - Date.parse(o.created_at) > EXPIRE_DAYS * 86_400_000;
}

export function breakdown(signals: Signal[], opps: Opportunity[], data: AllData, now = Date.now()): Breakdown {
  const signalIds = new Set(signals.map((s) => s.id));
  const available =
    sumValues(signals, data).available +
    expectedValue(opps.filter((o) => !o.signal_id || !signalIds.has(o.signal_id)));
  const empty = (): Segment => ({ value: 0, count: 0, amount: 0 });
  const segments: Record<SegmentKey, Segment> = { won: empty(), sentOpen: empty(), pushed: empty(), open: empty() };
  const lost = { count: 0, amount: 0 };
  const expired = { count: 0, amount: 0 };
  for (const o of opps) {
    const ev = (o.amount * o.score) / 100;
    if (o.stage === "lost") {
      lost.count++;
      lost.amount += o.amount;
      continue;
    }
    if (isExpired(o, now)) {
      expired.count++;
      expired.amount += o.amount;
      continue;
    }
    const key: SegmentKey = o.stage === "won" ? "won" : o.stage === "sent" ? "sentOpen" : o.stage === "pushed" ? "pushed" : "open";
    segments[key].value += ev;
    segments[key].count++;
    segments[key].amount += o.amount;
  }
  // Matched accounts nobody generated: open while the signal is recent,
  // part of "lost or expired" once it is older than the expiry.
  for (const sig of signals) {
    if (now - Date.parse(`${sig.week_of}T00:00:00Z`) > EXPIRE_DAYS * 86_400_000) continue;
    const v = signalValue(sig, data);
    segments.open.value += v.ungeneratedValue;
    segments.open.count += v.ungenerated;
  }
  const used = Object.values(segments).reduce((s, g) => s + g.value, 0);
  return {
    available,
    segments,
    remainder: Math.max(0, available - used),
    lost,
    expired,
    signals: signals.length,
    wonPct: available > 0 ? (segments.won.value / available) * 100 : null,
  };
}

export type WeekRow = { week: string; breakdown: Breakdown };

// Per-week breakdowns for one rep (or everyone when repId is null), newest
// first, for weeks between from and to (inclusive) that have any data.
export function weeklyBreakdowns(data: AllData, repId: string | null, from: string, to: string, now = Date.now()): WeekRow[] {
  const signalById = new Map(data.signals.map((s) => [s.id, s]));
  const signals = data.signals.filter((s) => (repId === null || s.rep_id === repId) && s.week_of >= from && s.week_of <= to);
  const opps = data.opps.filter((o) => repId === null || o.rep_id === repId);
  const weeks = new Set<string>();
  for (const s of signals) weeks.add(weekStart(s.week_of));
  const oppsByWeek = new Map<string, Opportunity[]>();
  for (const o of opps) {
    const w = weekStart(oppWeek(o, signalById));
    if (w < weekStart(from) || w > to) continue;
    weeks.add(w);
    oppsByWeek.set(w, [...(oppsByWeek.get(w) ?? []), o]);
  }
  return [...weeks]
    .sort()
    .reverse()
    .map((w) => ({
      week: w,
      breakdown: breakdown(
        signals.filter((s) => weekStart(s.week_of) === w),
        oppsByWeek.get(w) ?? [],
        data,
        now,
      ),
    }));
}

// Sum of weekly rows: the period total.
export function totalBreakdown(rows: WeekRow[]): Breakdown {
  const empty = (): Segment => ({ value: 0, count: 0, amount: 0 });
  const t: Breakdown = {
    available: 0,
    segments: { won: empty(), sentOpen: empty(), pushed: empty(), open: empty() },
    remainder: 0,
    lost: { count: 0, amount: 0 },
    expired: { count: 0, amount: 0 },
    signals: 0,
    wonPct: null,
  };
  for (const { breakdown: b } of rows) {
    t.available += b.available;
    t.remainder += b.remainder;
    t.signals += b.signals;
    t.lost.count += b.lost.count;
    t.lost.amount += b.lost.amount;
    t.expired.count += b.expired.count;
    t.expired.amount += b.expired.amount;
    for (const k of Object.keys(t.segments) as SegmentKey[]) {
      t.segments[k].value += b.segments[k].value;
      t.segments[k].count += b.segments[k].count;
      t.segments[k].amount += b.segments[k].amount;
    }
  }
  t.wonPct = t.available > 0 ? (t.segments.won.value / t.available) * 100 : null;
  return t;
}

// ---------------------------------------------------------------- periods and team rows (VS-9)
// Composition only: these call the functions above, so /team and /team/[repId]
// can never disagree.

// VS-12 T18: one set of periods everywhere, keyed ?period=week|month|quarter.
// Week = the current week (the newest signal's); Month = the weeks whose Monday
// falls in the current week's calendar month; Quarter = its calendar quarter.
export const PERIODS = [
  { key: "week", label: "Week", phrase: "this week" },
  { key: "month", label: "Month", phrase: "this month" },
  { key: "quarter", label: "Quarter", phrase: "this quarter" },
] as const;
export type Period = (typeof PERIODS)[number];
export type PeriodKey = Period["key"];

export function periodFor(key: unknown, fallback: PeriodKey = "week"): Period {
  return PERIODS.find((p) => p.key === key) ?? PERIODS.find((p) => p.key === fallback)!;
}

const quarterOf = (iso: string) => `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;

export function inPeriod(weekOf: string, current: string | null, period: Period): boolean {
  if (!current) return false;
  const w = weekStart(weekOf);
  const c = weekStart(current);
  if (w > c) return false;
  if (period.key === "week") return w === c;
  if (period.key === "month") return w.slice(0, 7) === c.slice(0, 7);
  return quarterOf(w) === quarterOf(c);
}

// The period's first and last calendar day (ISO dates), for range queries.
export function periodRange(current: string, period: Period): { from: string; to: string; label: string } {
  const c = weekStart(current);
  const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
  const y = Number(c.slice(0, 4));
  const m = Number(c.slice(5, 7)) - 1;
  if (period.key === "week") {
    const end = new Date(`${c}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return { from: c, to: end.toISOString().slice(0, 10), label: "this week" };
  }
  if (period.key === "month") {
    const name = new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    return { from: d(y, m, 1), to: d(y, m + 1, 0), label: name };
  }
  const q0 = Math.floor(m / 3) * 3;
  return { from: d(y, q0, 1), to: d(y, q0 + 3, 0), label: `Q${q0 / 3 + 1}` };
}

// Every Monday in [from, to], newest first.
export function mondaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${weekStart(from)}T12:00:00Z`);
  if (d.toISOString().slice(0, 10) < from) d.setUTCDate(d.getUTCDate() + 7);
  while (d.toISOString().slice(0, 10) <= to) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out.reverse();
}

// Signals whose week falls in the period, relative to the newest signal's week.
export function periodSignals(signals: Signal[], period: Period): Signal[] {
  const current = signals.reduce<string | null>((max, s) => (max && max > s.week_of ? max : s.week_of), null);
  return signals.filter((s) => inPeriod(s.week_of, current, period));
}

export type TeamRow = {
  signals: Signal[];
  value: SignalValue;
  capture: number | null;
  tta: number | null;
  offTerritory: number;
  signalDriven: number | null;
};

// One rep's numbers for a period: the same six columns as /team plus
// Off-territory and Signal-driven (those two, and time to act, span all weeks).
export function teamRow(repId: string, data: AllData, period: Period): TeamRow {
  const signals = periodSignals(data.signals, period).filter((s) => s.rep_id === repId);
  const value = sumValues(signals, data);
  return {
    signals,
    value,
    capture: captureRate(value),
    tta: timeToAct(repId, data),
    offTerritory: offTerritoryCount(repId, data),
    signalDriven: signalDrivenShare(repId, data),
  };
}

// Capture rate per signal week for one rep, oldest first (null = no signals that week).
export function weeklyCapture(repId: string, data: AllData): { week: string; capture: number | null }[] {
  return signalWeeks(data.signals).map((week) => {
    const signals = data.signals.filter((s) => s.rep_id === repId && s.week_of === week);
    return { week, capture: signals.length ? captureRate(sumValues(signals, data)) : null };
  });
}
