import Link from "next/link";
import { BrandMark } from "@/components/Header";
import { currentWeek, inWeek, RETIRED_WEEK } from "@/lib/data";
import { getSupabase } from "@/lib/supabase";
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

async function signalsThisWeek(): Promise<Map<string, number> | null> {
  try {
    const { data, error } = await getSupabase().from("signals").select("rep_id,week_of").gt("week_of", RETIRED_WEEK);
    if (error || !data) return null;
    const rows = data as Pick<Signal, "rep_id" | "week_of">[];
    const week = currentWeek(rows as Signal[]);
    const counts = new Map<string, number>();
    for (const s of rows) if (s.rep_id && inWeek(s.week_of, week)) counts.set(s.rep_id, (counts.get(s.rep_id) ?? 0) + 1);
    return counts;
  } catch {
    return null;
  }
}

function ChoiceCard({ title, line, children }: { title: string; line: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-[#d9dee3] bg-white px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3a728a]">{title}</p>
      <p className="text-[15px] leading-relaxed text-[#3f4e5b]">{line}</p>
      {children}
    </div>
  );
}

const REPO_URL = "https://github.com/Kacheek77/valstone-2026-hackathon";

function InfoCard({ title, tone, children }: { title: string; tone: "plain" | "solution"; children: React.ReactNode }) {
  const styles = {
    plain: { bg: "#f6f7f8", bar: "#3a728a", text: "#3a728a" },
    solution: { bg: "#e6f4ec", bar: "#1f9d55", text: "#1f9d55" },
  }[tone];
  return (
    <div className="flex flex-col gap-2 rounded-xl border-t-[5px] px-5 py-4" style={{ background: styles.bg, borderColor: styles.bar }}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: styles.text }}>
        {title}
      </p>
      <div className="text-[15px] leading-relaxed text-[#3f4e5b]">{children}</div>
    </div>
  );
}

// Final copy (her voice pass, 2026-09-29).
export default async function Welcome() {
  const counts = await signalsThisWeek();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(15,20,25,0.12)]">
        <div className="flex flex-col gap-3 bg-gradient-to-r from-[#142e3a] to-[#3a728a] px-6 py-7 sm:px-9">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <BrandMark className="h-7 w-7" color="#cee5f3" />
            <p className="text-xl font-bold text-white">Signal Desk</p>
            <p className="text-sm text-[#cee5f3]">· Valstone Fall Summit 2026 Hackathon · Problem 1, Sales</p>
          </div>
          <h1 className="max-w-4xl text-2xl font-bold leading-snug text-white sm:text-3xl">
            The weather changes what every farm needs this week.
            <br />
            Signal Desk automates capturing and pursuing that opportunity.
          </h1>
        </div>

        <div className="flex flex-col gap-4 px-6 py-6 sm:px-9">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="The business" tone="plain">
              <p>ThiboLiSoft&apos;s FieldSense software for crop growers comprises three products:</p>
              <ul className="my-2 list-disc pl-5 font-semibold">
                <li>Irrigation Scheduling</li>
                <li>Field-Work Planner</li>
                <li>Yield &amp; Insurance Records</li>
              </ul>
              <p>Each product is utilized in the week the weather turns and affects the farm.</p>
            </InfoCard>
            <InfoCard title="Our solution" tone="solution">
              <p>
                Signal Desk removes the need for sales reps to manually search territories and automates their outreach after
                weather events.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Reads county weather reports and flags drought, heavy rain and significant weather events</li>
                <li>Matches affected accounts by crop and FieldSense module gap</li>
                <li>Scores each one and writes why now and the outreach email</li>
                <li>One click creates the opportunity and tasks and initiates the sales workflow</li>
              </ul>
            </InfoCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ChoiceCard title="Manager view" line="Team performance across six reps: who acted on this week's weather and who did not.">
              {/* Plain <a>: /view sets a cookie, so it must never be prefetched. */}
              <a
                href="/view?as=manager"
                className="mt-auto block rounded-lg bg-[#3a728a] px-5 py-2.5 text-center text-sm font-bold text-white transition-colors duration-150 hover:bg-[#142e3a]"
              >
                Open Team view →
              </a>
            </ChoiceCard>
            <ChoiceCard title="Rep view" line="Pick a rep to open their dashboard.">
              <ul className="-mx-2 flex flex-col">
                {REPS.map((r) => {
                  const n = counts?.get(r.id) ?? 0;
                  return (
                    <li key={r.id}>
                      <a
                        href={`/view?as=${r.id}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-[#eef5f9]"
                      >
                        <span className="min-w-0 flex-1 text-sm">
                          <b className="text-[#142e3a]">{r.name}</b>
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
            className="block rounded-xl border border-dashed border-[#3a728a] px-5 py-3 text-center text-[15px] font-semibold text-[#3a728a] transition-colors duration-150 hover:bg-[#eef5f9]"
          >
            Try it on your company →
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
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-[#3a728a] underline underline-offset-2 hover:text-[#142e3a]">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
