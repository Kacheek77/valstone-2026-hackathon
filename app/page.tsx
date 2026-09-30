import Link from "next/link";
import { FA } from "@/components/faIcons";
import { BrandMark } from "@/components/Header";
import { HeroBuild } from "@/components/HeroBuild";
import { TeamThumb, type ThumbSignal } from "@/components/TeamThumb";
import { CountUp } from "@/components/CountUp";
import { loadAll } from "@/lib/data";
import { matchAccounts } from "@/lib/match";
import { periodFor, periodSignals, sumValues } from "@/lib/metrics";
import type { Signal } from "@/lib/types";

// Cached and re-rendered at most once a minute (and on every Reset or
// Refresh). The one data call is for the signal badges; if it fails the page
// still renders, without them.
export const revalidate = 60;

// Matches the seed's reps.
const REPS = [
  { id: "REP-01", name: "Jordan Ellsworth", territory: "Southwest Kansas", demo: true },
  { id: "REP-02", name: "Priya Nathan", territory: "Northwest & Central Kansas" },
  { id: "REP-03", name: "Marcus Deleon", territory: "Southwest Nebraska" },
  { id: "REP-04", name: "Renee Okafor", territory: "Oklahoma Panhandle" },
  { id: "REP-05", name: "Tyler Bramlett", territory: "Texas Panhandle" },
  { id: "REP-06", name: "Sofia Marchetti", territory: "Nebraska Panhandle" },
];

type WeekSignal = Pick<Signal, "rep_id" | "week_of" | "type" | "severity" | "lat" | "lng">;

type Week = {
  byRep: Map<string, WeekSignal[]>;
  all: WeekSignal[];
  // VS-13 W4: the live numbers band.
  accounts: number;
  reps: number;
  available: number;
};

// This week's signals, by rep, plus the band's totals. Null (no badges, no
// thumbnail, no band) when the database is unreachable.
async function thisWeek(): Promise<Week | null> {
  try {
    const loaded = await loadAll();
    if (!loaded.ok) return null;
    const data = loaded.data;
    const all = periodSignals(data.signals, periodFor("week"));
    const byRep = new Map<string, WeekSignal[]>();
    for (const s of all) if (s.rep_id) byRep.set(s.rep_id, [...(byRep.get(s.rep_id) ?? []), s]);
    const affected = new Set<string>();
    for (const s of all) {
      for (const m of matchAccounts(s, data.accounts, data.reps)) affected.add(m.account.id);
      for (const o of data.opps) if (o.signal_id === s.id) affected.add(o.account_id);
    }
    return {
      byRep,
      all,
      accounts: affected.size,
      reps: data.reps.filter((r) => !r.is_manager).length,
      available: sumValues(all, data).available,
    };
  } catch {
    return null;
  }
}

// VS-13 W7: faint topographic contours drifting in the header band.
function Contours() {
  const rings = [0, 1, 2, 3, 4, 5, 6];
  const ring = (cx: number, cy: number, k: number, wob: number) => {
    const pts: string[] = [];
    for (let a = 0; a <= 360; a += 15) {
      const t = (a * Math.PI) / 180;
      const r = 40 + k * 34 + Math.sin(t * 3 + k) * wob + Math.cos(t * 2 - k) * wob * 0.6;
      pts.push(`${(cx + Math.cos(t) * r * 1.5).toFixed(1)},${(cy + Math.sin(t) * r).toFixed(1)}`);
    }
    return `M${pts.join(" L")} Z`;
  };
  return (
    <svg aria-hidden className="sd-contours pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1200 320">
      <g fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.07">
        {rings.map((k) => (
          <path key={`a${k}`} d={ring(260, 250, k, 9)} />
        ))}
        {rings.slice(0, 5).map((k) => (
          <path key={`b${k}`} d={ring(980, 60, k, 12)} />
        ))}
      </g>
    </svg>
  );
}

const TYPE_ICON = { drought: "sun-plant-wilt", rain: "cloud-showers-heavy", heat: "temperature-arrow-up" } as const;
const TYPE_COLOR = { drought: "#d23b3b", rain: "#2a6fb5", heat: "#f55a00" } as const;

function TypeIcon({ type }: { type: keyof typeof TYPE_ICON }) {
  const i = FA[TYPE_ICON[type]];
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ background: TYPE_COLOR[type] }} title={type}>
      <svg viewBox={i.viewBox} width="11" height="11" aria-hidden>
        <path d={i.d} fill="#fff" />
      </svg>
    </span>
  );
}

function ChoiceCard({ title, line, children }: { title: string; line: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[#d9dee3] bg-white px-5 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3a728a]">{title}</p>
      <p className="text-sm leading-relaxed text-[#3f4e5b]">{line}</p>
      {children}
    </div>
  );
}


function InfoCard({ title, tone, children }: { title: string; tone: "plain" | "solution"; children: React.ReactNode }) {
  const styles = {
    plain: { bg: "#f6f7f8", bar: "#3a728a", text: "#3a728a" },
    solution: { bg: "#e6f4ec", bar: "#1f9d55", text: "#1f9d55" },
  }[tone];
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border-t-[4px] px-5 py-3" style={{ background: styles.bg, borderColor: styles.bar }}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: styles.text }}>
        {title}
      </p>
      <div className="text-sm leading-relaxed text-[#3f4e5b]">{children}</div>
    </div>
  );
}

// Final copy (her voice pass, 2026-09-29).
export default async function Welcome() {
  const week = await thisWeek();
  const counts = week ? new Map([...week.byRep].map(([k, v]) => [k, v.length])) : null;
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-5 sm:px-6">
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(15,20,25,0.12)]">
        {/* VS-13 W1 + W2: the headline left (about 55%), its animation right (W3). */}
        <div className="relative grid items-center gap-5 overflow-hidden bg-gradient-to-r from-[#142e3a] to-[#3a728a] px-6 py-4 sm:px-8 md:grid-cols-[55fr_45fr]">
          <Contours />
          <div className="relative flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#cee5f3]">
              <BrandMark className="h-5 w-5" color="#cee5f3" />
              <span className="font-bold text-white">Signal Desk</span>
              <span>· Valstone Fall Summit 2026 Hackathon · Problem 1, Sales</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight text-white lg:text-[34px]">From random outreach to targeted selling and conversion.</h1>
            <p className="text-lg leading-snug text-[#cee5f3]">
              Signal Desk reads this week&apos;s weather, finds the farms it affects, and writes the outreach.
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-[340px] rounded-xl bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
            <HeroBuild />
          </div>
        </div>

        {/* VS-13 W4: live numbers, from the database; absent if it is unreachable. */}
        {week && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-[#d9e7ee] bg-[#eef5f9] px-6 py-1.5 text-sm text-[#2c5a6e] sm:px-8">
            <b>This week:</b>
            <span>
              <CountUp value={week.all.length} format="int" /> signals
            </span>
            ·
            <span>
              <CountUp value={week.accounts} format="int" /> accounts
            </span>
            ·
            <span>
              <CountUp value={week.reps} format="int" /> reps
            </span>
            ·
            <span>
              <b>
                <CountUp value={week.available} format="usd" />
              </b>{" "}
              expected value available
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 px-6 py-4 sm:px-8">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="The business" tone="plain">
              <p>ThiboLiSoft&apos;s FieldSense software for crop growers comprises three products:</p>
              {/* VS-13 W6: each product with the weather that triggers it. */}
              <div className="my-1.5 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["Irrigation Scheduling", "drought", "drought worsens"],
                    ["Field-Work Planner", "rain", "heavy rain"],
                    ["Yield & Insurance Records", "heat", "heat or hail"],
                  ] as const
                ).map(([name, type, trigger]) => (
                  <div key={name} className="flex items-start gap-2 rounded-lg border border-[#e3e7eb] bg-white px-2.5 py-1.5">
                    <span className="mt-0.5 shrink-0">
                      <TypeIcon type={type} />
                    </span>
                    <span className="leading-tight">
                      <b className="block text-[13px] text-[#142e3a]">{name}</b>
                      <span className="text-xs text-[#5a6975]">← {trigger}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p>Each product is utilized in the week the weather turns and affects the farm.</p>
            </InfoCard>
            <InfoCard title="Our solution" tone="solution">
              <p>
                Signal Desk removes the need for sales reps to manually search territories and automates their outreach after
                weather events.
              </p>
              <ul className="mt-1 list-disc pl-5">
                <li>Reads county weather reports and flags drought, heavy rain and significant weather events</li>
                <li>Matches affected accounts by crop and FieldSense module gap</li>
                <li>Scores each one and writes why now and the outreach email</li>
                <li>One click creates the opportunity and tasks and initiates the sales workflow</li>
              </ul>
            </InfoCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ChoiceCard title="Manager view" line="Team performance across six reps: who acted on this week's weather and who did not.">
              <div className="mt-auto flex items-end gap-4">
                {/* Plain <a>: /view sets a cookie, so it must never be prefetched. */}
                <a
                  href="/view?as=manager"
                  className="block flex-1 rounded-lg bg-[#3a728a] px-5 py-2.5 text-center text-sm font-bold text-white transition-colors duration-150 hover:bg-[#142e3a]"
                >
                  Open Team view →
                </a>
                {/* VS-13 W8: the team map in miniature (portrait, like the territories). */}
                {week && (
                  <a href="/view?as=manager" tabIndex={-1} className="block h-44 w-32 shrink-0 overflow-hidden rounded-lg border border-[#e3e7eb]" aria-label="Open Team view">
                    <TeamThumb signals={week.all as ThumbSignal[]} />
                  </a>
                )}
              </div>
            </ChoiceCard>
            <ChoiceCard title="Rep view" line="Pick a rep to open their dashboard.">
              <ul className="-mx-2 flex flex-col">
                {REPS.map((r) => {
                  const n = counts?.get(r.id) ?? 0;
                  return (
                    <li key={r.id}>
                      <a
                        href={`/view?as=${r.id}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-[#eef5f9]"
                      >
                        <span className="min-w-0 flex-1 text-sm">
                          <b className="text-[#142e3a]">{r.name}</b>
                          <span className="ml-2 inline-flex translate-y-[3px] gap-1">
                            {[...new Set((week?.byRep.get(r.id) ?? []).map((x) => x.type))].map((t) => (
                              <TypeIcon key={t} type={t} />
                            ))}
                          </span>
                          {r.demo && (
                            <span className="ml-2 rounded bg-[#eef5f9] px-1.5 py-0.5 text-[11px] font-semibold text-[#3a728a]">demo rep</span>
                          )}
                          <span className="ml-2 inline-block text-[#7a8794]">{r.territory}</span>
                        </span>
                        {counts && (
                          <span
                            className="shrink-0 rounded-full border border-[#d9dee3] px-2 py-0.5 text-[11px] font-semibold text-[#3f4e5b]"
                            title={`${n} signal${n === 1 ? "" : "s"} this week`}
                          >
                            {n} this week
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </ChoiceCard>
          </div>

          {/* VS-13 TRY */}
          <Link
            href="/try"
            className="block rounded-xl border border-dashed border-[#3a728a] px-5 py-2 text-center text-[15px] font-semibold text-[#3a728a] transition-colors duration-150 hover:bg-[#eef5f9]"
          >
            Try it with your company →
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            {/* VS-13 TEAM */}
            <p className="text-sm text-[#7a8794]">Built by Team Force Majeure · Chris Jackson · Lindsay Chim</p>
            <div className="flex flex-wrap gap-5 text-sm">
              <Link href="/terms" className="text-[#3a728a] underline underline-offset-2 hover:text-[#142e3a]">
                Terminology
              </Link>
              <Link href="/about" className="text-[#3a728a] underline underline-offset-2 hover:text-[#142e3a]">
                What is real vs. seeded
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
