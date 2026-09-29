import Link from "next/link";
import { Header } from "@/components/Header";
import { BarLegend, StackedBar, wonColor } from "@/components/StackedBar";
import { Card, EmptyState, ErrorBox, Page } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { usd, weekLabel } from "@/lib/format";
import { totalBreakdown, weeklyBreakdowns, type WeekRow } from "@/lib/metrics";
import { getView, parseView } from "@/lib/view";

export const dynamic = "force-dynamic";

// Q3 2026. "Season" covers the same weeks until the data spans more than a
// quarter, so its pill is disabled.
const QUARTER = { from: "2026-07-01", to: "2026-09-30", label: "Q3" };

function WeekRows({ rows }: { rows: WeekRow[] }) {
  const scale = Math.max(0, ...rows.map((r) => r.breakdown.available));
  return (
    <Card className="px-5 py-4">
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.week} className="grid grid-cols-[56px_minmax(0,1fr)_130px] items-center gap-3 text-sm">
            <span className="font-medium text-[#3f4e5b]">{weekLabel(r.week)}</span>
            <StackedBar b={r.breakdown} scale={scale} />
            <span className="whitespace-nowrap text-right tabular-nums text-[#5a6975]">
              {usd(r.breakdown.available)} · {r.breakdown.signals} sig
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PeriodPills() {
  return (
    <div className="flex gap-2 text-sm" role="group" aria-label="Period">
      <span className="rounded-full bg-[#3a728a] px-4 py-1.5 font-medium text-white">Quarter</span>
      <button
        type="button"
        disabled
        title="Same weeks as the quarter until the data spans more than one quarter"
        className="cursor-not-allowed rounded-full border border-[#bcc4cb] px-4 py-1.5 text-[#9aa5ae]"
      >
        Season
      </button>
    </div>
  );
}

const FOOTNOTE =
  "Bar length = expected value available that week. Gray remainder = lost or expired. Prior-week figures are seeded history. Time to act = signal to accept.";

export default async function Results(props: PageProps<"/results">) {
  const sp = await props.searchParams;
  const view = await getView();
  const override = parseView(typeof sp.rep === "string" ? sp.rep : null);
  const repId = override?.kind === "rep" ? override.repId : view.kind === "rep" ? view.repId : null;
  const byWeek = sp.by === "week";

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

  // ---------------------------------------------------------------- rep view
  if (repId !== null) {
    const rep = salesReps.find((r) => r.id === repId);
    const header = <Header view={view} reps={data.reps} active="results" selected={repId} />;
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
    const rows = weeklyBreakdowns(data, rep.id, QUARTER.from, QUARTER.to);
    const total = totalBreakdown(rows);
    return (
      <>
        {header}
        <Page>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{QUARTER.label} to date · closed against what the weather created</h1>
              <p className="text-[#5a6975]">
                {rep.name} · Won {usd(total.segments.won.value)} of {usd(total.available)} expected value available ·{" "}
                {rows.length} week{rows.length === 1 ? "" : "s"}
              </p>
            </div>
            <PeriodPills />
          </div>
          {rows.length === 0 ? (
            <EmptyState>No results yet for this period.</EmptyState>
          ) : (
            <>
              <Card className="mb-4 flex flex-col gap-3 px-5 py-4">
                <StackedBar b={total} scale={total.available} height="h-8" />
                <BarLegend b={total} />
              </Card>
              <h2 className="mb-2 font-semibold text-[#3f4e5b]">By week</h2>
              <WeekRows rows={rows} />
            </>
          )}
          <p className="mt-3 text-xs text-[#7a8794]">
            {FOOTNOTE} All values are expected value (amount × score ÷ 100). List-prospected opportunities sit in the week they
            were created. Hover a segment for counts.
          </p>
        </Page>
      </>
    );
  }

  // ---------------------------------------------------------------- manager view
  const teamRows = weeklyBreakdowns(data, null, QUARTER.from, QUARTER.to);
  const team = totalBreakdown(teamRows);
  const repRows = salesReps.map((rep) => ({ rep, b: totalBreakdown(weeklyBreakdowns(data, rep.id, QUARTER.from, QUARTER.to)) }));
  const repScale = Math.max(0, ...repRows.map((r) => r.b.available));

  return (
    <>
      <Header view={view} reps={data.reps} active="results" selected="manager" />
      <Page>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Plains region · {QUARTER.label} to date · {salesReps.length} reps
            </h1>
            <p className="text-[#5a6975]">
              Won {usd(team.segments.won.value)} of {usd(team.available)} expected value available · team close rate{" "}
              <b className={wonColor(team.wonPct)}>{team.wonPct === null ? "—" : `${Math.round(team.wonPct)}%`}</b> ·{" "}
              {teamRows.length} weeks
            </p>
          </div>
          <PeriodPills />
        </div>

        <Card className="mb-4 flex flex-col gap-3 px-5 py-4">
          <StackedBar b={team} scale={team.available} height="h-8" />
          <BarLegend b={team} />
        </Card>

        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-[#3f4e5b]">{byWeek ? "Team by week" : "By rep"}</h2>
          <div className="flex gap-2 text-sm" role="group" aria-label="Rows">
            <Link
              href="/results"
              className={`rounded-full px-3 py-1 transition-colors duration-150 ${!byWeek ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"}`}
            >
              By rep
            </Link>
            <Link
              href="/results?by=week"
              className={`rounded-full px-3 py-1 transition-colors duration-150 ${byWeek ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"}`}
            >
              By week
            </Link>
          </div>
        </div>

        {byWeek ? (
          <WeekRows rows={teamRows} />
        ) : (
          <Card className="px-5 py-4">
            <div className="flex flex-col gap-1">
              {repRows.map(({ rep, b }) => (
                <a
                  key={rep.id}
                  // Plain <a>: /view sets the rep view cookie, then lands on their results.
                  href={`/view?as=${rep.id}&to=results`}
                  className="grid grid-cols-[150px_minmax(0,1fr)_150px] items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors duration-150 hover:bg-[#f6f7f8]"
                >
                  <span className="truncate font-semibold text-[#3a728a]">{rep.name}</span>
                  <StackedBar b={b} scale={repScale} />
                  <span className="whitespace-nowrap text-right tabular-nums">
                    <span className="text-[#5a6975]">{usd(b.available)}</span> ·{" "}
                    <b className={wonColor(b.wonPct)}>Won {b.wonPct === null ? "—" : `${Math.round(b.wonPct)}%`}</b>
                  </span>
                </a>
              ))}
            </div>
          </Card>
        )}
        <p className="mt-3 text-xs text-[#7a8794]">
          {byWeek ? FOOTNOTE : "Bar length = expected value available to that rep this quarter. Gray remainder = lost or expired. Prior-week figures are seeded history."}{" "}
          Won % = won ÷ available, in expected value (amount × score ÷ 100); green 15%+, amber 8–14%, red under 8%. Click a rep
          to open their results.
        </p>
      </Page>
    </>
  );
}
