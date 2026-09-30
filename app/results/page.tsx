import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { Header } from "@/components/Header";
import { PeriodPills } from "@/components/PeriodPills";
import { BarLegend, StackedBar, wonColor } from "@/components/StackedBar";
import { Card, EmptyState, ErrorBox, InfoTip, Page } from "@/components/ui";
import { currentWeek, loadAll } from "@/lib/data";
import { usd, weekLabel } from "@/lib/format";
import { mondaysBetween, periodFor, periodRange, totalBreakdown, weekStart, weeklyBreakdowns, type Period, type PeriodKey, type WeekRow } from "@/lib/metrics";
import { getView, parseView } from "@/lib/view";

export const dynamic = "force-dynamic";

// VS-12 T18: Week / Month / Quarter, defaulting to Quarter here.
const FALLBACK = { from: "2026-07-01", to: "2026-09-30", label: "Q3" };

function heading(period: Period, label: string): string {
  return period.key === "week" ? "This week" : `${label} to date`;
}

// VS-12 T17: every week of the period, newest first; weeks with no value are a
// thin gray row, so the calendar reads continuously.
function WeekRows({ rows, weeks }: { rows: WeekRow[]; weeks: string[] }) {
  const scale = Math.max(0, ...rows.map((r) => r.breakdown.available));
  const byWeek = new Map(rows.map((r) => [r.week, r]));
  const all = [...new Set([...weeks, ...rows.map((r) => r.week)])].sort().reverse();
  return (
    <Card className="px-5 py-4">
      <div className="flex flex-col gap-3">
        {all.map((w, i) => {
          const r = byWeek.get(w);
          if (!r || r.breakdown.available === 0) {
            return (
              <div key={w} className="grid grid-cols-[56px_minmax(0,1fr)_130px] items-center gap-3 text-sm">
                <span className="font-medium text-[#9aa5ae]">{weekLabel(w)}</span>
                <span className="h-1 rounded-full bg-[#e3e7eb]" />
                <span className="text-right text-xs text-[#9aa5ae]">no signals</span>
              </div>
            );
          }
          return (
            <div key={w} className="grid grid-cols-[56px_minmax(0,1fr)_130px] items-center gap-3 text-sm">
              <span className="font-medium text-[#3f4e5b]">{weekLabel(w)}</span>
              <StackedBar b={r.breakdown} scale={scale} delay={i * 60} />
              <span className="whitespace-nowrap text-right tabular-nums text-[#5a6975]">
                {usd(r.breakdown.available)} · {r.breakdown.signals} sig
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const WEEK_TIP =
  "Bar length = expected value available that week (amount × score ÷ 100). Hatched = open, not yet worked; gray = lost or expired. Hover a segment for counts.";
const REP_TIP =
  "Bar length = expected value available to that rep in the period. Won % = won ÷ available: green 15%+, amber 8–14%, red under 8%.";

export default async function Results(props: PageProps<"/results">) {
  const sp = await props.searchParams;
  const view = await getView();
  const override = parseView(typeof sp.rep === "string" ? sp.rep : null);
  const repId = override?.kind === "rep" ? override.repId : view.kind === "rep" ? view.repId : null;
  const byWeek = sp.by === "week";
  const period = periodFor(sp.period, "quarter");
  const chosen = typeof sp.period === "string" && sp.period === period.key ? period.key : undefined;
  const href = (key: PeriodKey, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams(extra);
    if (key !== "quarter") q.set("period", key);
    const qs = q.toString();
    return `/results${qs ? `?${qs}` : ""}`;
  };

  const loaded = await loadAll();
  if (!loaded.ok) {
    return (
      <>
        <Header view={view} reps={null} active="results" />
        <Page>
          <ErrorBox>{loaded.error} Results will load once the database is reachable.</ErrorBox>
        </Page>
      </>
    );
  }
  const data = loaded.data;
  const salesReps = data.reps.filter((r) => !r.is_manager);
  const week = currentWeek(data.signals);
  const range = week ? periodRange(week, period) : FALLBACK;
  // Calendar weeks of the period so far (the quarter to date is 13 weeks).
  const weeks = mondaysBetween(range.from, week && weekStart(week) < range.to ? weekStart(week) : range.to);
  const weekCount = (rows: WeekRow[]) =>
    `${weeks.length} week${weeks.length === 1 ? "" : "s"} · ${rows.filter((r) => r.breakdown.signals > 0).length} with signals`;

  // ---------------------------------------------------------------- rep view
  if (repId !== null) {
    const rep = salesReps.find((r) => r.id === repId);
    // VS-9: a manager drilling in via ?rep= stays the manager.
    const managerView = view.kind === "manager";
    const header = <Header view={view} reps={data.reps} active="results" selected={managerView ? "manager" : repId} period={chosen} />;
    if (!rep) {
      return (
        <>
          {header}
          <Page>
            <ErrorBox>There is no rep with that id. Pick one from the switcher above.</ErrorBox>
          </Page>
        </>
      );
    }
    const rows = weeklyBreakdowns(data, rep.id, range.from, range.to);
    const total = totalBreakdown(rows);
    return (
      <>
        {header}
        <Page>
          {managerView && (
            <nav className="mb-3 text-sm text-[#5a6975]" aria-label="Breadcrumb">
              <Link href="/results" className="text-[#3a728a] hover:underline">
                Results
              </Link>{" "}
              › <span className="text-[#0f1419]">{rep.name}</span>
            </nav>
          )}
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{heading(period, range.label)} · closed against what the weather created</h1>
              <p className="text-[#5a6975]">
                {rep.name} · Won <CountUp value={total.segments.won.value} format="usd" /> of{" "}
                <CountUp value={total.available} format="usd" /> expected value available ·{" "}
                {weekCount(rows)}
              </p>
            </div>
            <PeriodPills current={period.key} href={(k) => href(k, { rep: rep.id })} />
          </div>
          {rows.length === 0 ? (
            <EmptyState>No results yet for this period.</EmptyState>
          ) : (
            <>
              <Card className="mb-4 flex flex-col gap-3 px-5 py-4">
                <StackedBar b={total} scale={total.available} height="h-8" />
                <BarLegend b={total} />
              </Card>
              <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-[#3f4e5b]">
                By week <InfoTip label="How this works">{WEEK_TIP}</InfoTip>
              </h2>
              <WeekRows rows={rows} weeks={weeks} />
            </>
          )}
        </Page>
      </>
    );
  }

  // ---------------------------------------------------------------- manager view
  const teamRows = weeklyBreakdowns(data, null, range.from, range.to);
  const team = totalBreakdown(teamRows);
  const repRows = salesReps.map((rep) => ({ rep, b: totalBreakdown(weeklyBreakdowns(data, rep.id, range.from, range.to)) }));
  const repScale = Math.max(0, ...repRows.map((r) => r.b.available));

  return (
    <>
      <Header view={view} reps={data.reps} active="results" selected="manager" period={chosen} />
      <Page>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Plains region · {heading(period, range.label)} · {salesReps.length} reps
            </h1>
            <p className="text-[#5a6975]">
              Won <CountUp value={team.segments.won.value} format="usd" /> of <CountUp value={team.available} format="usd" /> expected
              value available · team close rate{" "}
              <b className={wonColor(team.wonPct)}>{team.wonPct === null ? "—" : <CountUp value={team.wonPct} format="pct" />}</b> ·{" "}
              {weekCount(teamRows)}
            </p>
          </div>
          <PeriodPills current={period.key} href={(k) => href(k, byWeek ? { by: "week" } : {})} />
        </div>

        <Card className="mb-4 flex flex-col gap-3 px-5 py-4">
          <StackedBar b={team} scale={team.available} height="h-8" />
          <BarLegend b={team} />
        </Card>

        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-semibold text-[#3f4e5b]">
            {byWeek ? "Team, week by week" : `Each rep ${period.phrase}`}
            <InfoTip label="How this works">{byWeek ? WEEK_TIP : REP_TIP}</InfoTip>
          </h2>
          <div className="flex gap-2 text-sm" role="group" aria-label="Rows">
            <Link
              href={href(period.key)}
              className={`rounded-full px-3 py-1 transition-colors duration-150 ${!byWeek ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"}`}
            >
              By rep
            </Link>
            <Link
              href={href(period.key, { by: "week" })}
              className={`rounded-full px-3 py-1 transition-colors duration-150 ${byWeek ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"}`}
            >
              By week
            </Link>
          </div>
        </div>

        {byWeek ? (
          <WeekRows rows={teamRows} weeks={weeks} />
        ) : (
          <Card className="px-5 py-4">
            <div className="flex flex-col gap-1">
              {repRows.map(({ rep, b }, i) => (
                <Link
                  key={rep.id}
                  // VS-9: drill in as the manager (no view switch).
                  href={href(period.key, { rep: rep.id })}
                  className="grid grid-cols-[150px_minmax(0,1fr)_150px] items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors duration-150 hover:bg-[#f6f7f8]"
                >
                  <span className="truncate font-semibold text-[#3a728a]">{rep.name}</span>
                  <StackedBar b={b} scale={repScale} delay={120 + i * 60} />
                  <span className="whitespace-nowrap text-right tabular-nums">
                    <span className="text-[#5a6975]">{usd(b.available)}</span> ·{" "}
                    <b className={wonColor(b.wonPct)}>Won {b.wonPct === null ? "—" : `${Math.round(b.wonPct)}%`}</b>
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </Page>
    </>
  );
}
