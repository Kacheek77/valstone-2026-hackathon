import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { hoursLabel } from "@/components/hoursLabel";
import { Sparkline } from "@/components/Sparkline";
import { Card, EmptyState, ErrorBox, Page, StageBadge, Tile } from "@/components/ui";
import { currentWeek, loadAll } from "@/lib/data";
import { captureColor, dateTime, eventLine, pct, usd, usdExact, weekLabel } from "@/lib/format";
import { periodFor, PERIODS, signalValue, teamRow, weekStart, weeklyCapture } from "@/lib/metrics";
import { formatDue, stepProgress, tasksDue } from "@/lib/steps";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

const REP_ID = /^REP-\d{2}$/;

// VS-9: the manager's drill-in on one rep. The viewer stays the manager; the
// numbers come from the same teamRow() as the /team row.
export default async function RepSummary(props: PageProps<"/team/[repId]">) {
  const { repId } = await props.params;
  if (!REP_ID.test(repId)) notFound();
  const sp = await props.searchParams;
  const period = periodFor(sp.period);
  const q = (key: string) => (key === "week" ? "" : `?period=${key}`);
  const view = await getView();

  const loaded = await loadAll();
  if (!loaded.ok) {
    return (
      <>
        <Header view={view} reps={null} active="team" selected="manager" />
        <Page>
          <ErrorBox>{loaded.error} This summary will load once the database is reachable.</ErrorBox>
        </Page>
      </>
    );
  }
  const data = loaded.data;
  const rep = data.reps.find((r) => r.id === repId && !r.is_manager);
  if (!rep) notFound();

  const row = teamRow(rep.id, data, period);
  const week = currentWeek(data.signals);
  const signalIds = new Set(row.signals.map((s) => s.id));
  const accountById = new Map(data.accounts.map((a) => [a.id, a]));
  const signalById = new Map(data.signals.map((s) => [s.id, s]));

  // The period's opportunities: those on the period's signals, plus
  // list-prospected ones created in the period's weeks.
  const inPeriodWeek = (iso: string) => {
    if (!week) return false;
    const diff = (Date.parse(week) - Date.parse(weekStart(iso))) / 86_400_000;
    return diff >= 0 && diff < period.days;
  };
  const opps = data.opps
    .filter((o) => o.rep_id === rep.id && (o.signal_id ? signalIds.has(o.signal_id) : inPeriodWeek(o.created_at)))
    .sort((a, b) => b.score - a.score);

  const weekly = weeklyCapture(rep.id, data);
  const sparkValues = weekly.map((w) => w.capture).filter((v): v is number => v !== null);
  const tasks = tasksDue(data, rep.id);

  return (
    <>
      <Header view={view} reps={data.reps} active="team" selected="manager" />
      <Page>
        <nav className="mb-3 text-sm text-[#5a6975]" aria-label="Breadcrumb">
          <Link href={`/team${q(period.key)}`} className="text-[#3a728a] hover:underline">
            Team
          </Link>{" "}
          › <span className="text-[#0f1419]">{rep.name}</span>
        </nav>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{rep.name}</h1>
            <p className="text-[#5a6975]">
              {rep.territory_name} · {rep.counties.map((c) => c.replace(/ County, /, ", ")).join(" · ")}
            </p>
          </div>
          <nav className="flex gap-2 text-sm" aria-label="Period">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/team/${rep.id}${q(p.key)}`}
                className={`rounded-full px-4 py-1.5 transition-colors duration-150 ${
                  p.key === period.key ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* 1. The same numbers as this rep's /team row. */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          <Tile label="Signals"><p className="text-xl font-bold tabular-nums">{row.signals.length}</p></Tile>
          <Tile label="Opps"><p className="text-xl font-bold tabular-nums">{row.value.generated}</p></Tile>
          <Tile label="Available"><p className="text-xl font-bold tabular-nums">{row.value.available > 0 ? usd(row.value.available) : "—"}</p></Tile>
          <Tile label="Captured"><p className="text-xl font-bold tabular-nums">{row.value.available > 0 ? usd(row.value.captured) : "—"}</p></Tile>
          <Tile label="Capture"><p className={`text-xl font-bold tabular-nums ${captureColor(row.capture)}`}>{pct(row.capture)}</p></Tile>
          <Tile label="Time to act"><p className="text-xl font-bold tabular-nums">{hoursLabel(row.tta)}</p></Tile>
          <Tile label="Off-territory"><p className="text-xl font-bold tabular-nums">{row.offTerritory}</p></Tile>
          <Tile label="Signal-driven"><p className="text-xl font-bold tabular-nums">{pct(row.signalDriven)}</p></Tile>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-5">
            {/* 2. Signals in territory: worked or ignored. */}
            <section>
              <h2 className="mb-2 font-semibold text-[#3f4e5b]">Signals in territory · {period.phrase}</h2>
              {row.signals.length === 0 ? (
                <EmptyState>No signals in {rep.territory_name} {period.phrase}.</EmptyState>
              ) : (
                <Card className="divide-y divide-[#eef0f2]">
                  {row.signals.map((s) => {
                    const v = signalValue(s, data);
                    const worked = v.generated > 0;
                    return (
                      <div key={s.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm ${worked ? "" : "bg-[#fdf2f2]"}`}>
                        <div className="min-w-0">
                          <Link href={`/signals/${s.id}`} className="font-semibold text-[#3a728a] hover:underline">
                            {eventLine(s)}
                          </Link>
                          <span className="ml-2 text-xs text-[#7a8794]">{weekLabel(s.week_of)}</span>
                        </div>
                        {worked ? (
                          <span className="text-[#3f4e5b]">
                            <b className="text-[#1f9d55]">Worked</b> · {v.generated} opp{v.generated === 1 ? "" : "s"} ·{" "}
                            {usd(v.available)} available / {usd(v.captured)} captured
                          </span>
                        ) : (
                          <span className="text-[#d23b3b]">
                            <b>Ignored</b> · 0 opps · {v.ungenerated} matching account{v.ungenerated === 1 ? "" : "s"} ·{" "}
                            {usd(v.available)} counted against the rep at score 50
                          </span>
                        )}
                      </div>
                    );
                  })}
                </Card>
              )}
            </section>

            {/* 3. Pipeline for the period, read-only. */}
            <section>
              <h2 className="mb-2 font-semibold text-[#3f4e5b]">Pipeline · {period.phrase}</h2>
              {opps.length === 0 ? (
                <EmptyState>No opportunities {period.phrase}.</EmptyState>
              ) : (
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-[#efefef] text-left text-[#3f4e5b]">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Score</th>
                        <th className="px-3 py-2.5 font-semibold">Account</th>
                        <th className="px-3 py-2.5 font-semibold">Signal</th>
                        <th className="px-3 py-2.5 font-semibold">Module</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                        <th className="px-3 py-2.5 font-semibold">Stage</th>
                        <th className="px-3 py-2.5 font-semibold">Created</th>
                        <th className="px-4 py-2.5" aria-label="Open" />
                      </tr>
                    </thead>
                    <tbody>
                      {opps.map((o) => {
                        const s = o.signal_id ? signalById.get(o.signal_id) : undefined;
                        const a = accountById.get(o.account_id);
                        const p = stepProgress(o, data.steps);
                        return (
                          <tr key={o.id} className="border-t border-[#eef0f2]">
                            <td className="px-4 py-3 font-bold tabular-nums text-[#3a728a]">{o.score}</td>
                            <td className="px-3 py-3">
                              <span className="font-semibold">{a?.name ?? "Unknown account"}</span>
                              <p className="text-xs text-[#7a8794]">
                                {a?.customer_status}
                                {p ? ` · ${p.done}/${p.total} steps` : ""}
                              </p>
                            </td>
                            <td className="px-3 py-3">{s ? eventLine(s) : <span className="text-[#7a8794]">List prospecting</span>}</td>
                            <td className="px-3 py-3">{o.lead_with}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{usdExact(o.amount)}</td>
                            <td className="px-3 py-3"><StageBadge stage={o.stage} /></td>
                            <td className="whitespace-nowrap px-3 py-3 text-[#5a6975]">{dateTime(o.created_at)}</td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/opportunities/${o.id}?from=${rep.id}`}
                                className="inline-flex whitespace-nowrap rounded-full border border-[#3a728a] px-3 py-1 text-xs font-semibold text-[#3a728a] transition-colors duration-150 hover:bg-[#3a728a] hover:text-white"
                              >
                                Open →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-5">
            {/* 4. Weekly capture across the season. */}
            <Card className="px-4 py-3">
              <h2 className="mb-1 font-semibold text-[#3f4e5b]">Weekly capture · {weekly.length} weeks</h2>
              {sparkValues.length >= 2 ? (
                <Sparkline values={sparkValues} color="#1f9d55" label={`${rep.name} weekly capture rate`} />
              ) : (
                <p className="text-sm text-[#7a8794]">Not enough weeks with signals yet.</p>
              )}
              <p className="mt-1 text-xs text-[#7a8794]">
                {weekly.filter((w) => w.capture !== null).length} weeks with signals · latest{" "}
                {pct([...weekly].reverse().find((w) => w.capture !== null)?.capture ?? null)}
              </p>
            </Card>

            {/* 5. Tasks due. */}
            <Card className="px-4 py-3">
              <h2 className="mb-2 font-semibold text-[#3f4e5b]">Tasks due · next 7 days</h2>
              {tasks.length === 0 ? (
                <p className="text-sm text-[#7a8794]">Nothing scheduled.</p>
              ) : (
                <ul className="divide-y divide-[#eef0f2] text-sm">
                  {tasks.map((t) => (
                    <li key={t.step.id} className="py-2">
                      <span className={t.overdue ? "font-semibold text-[#d23b3b]" : "text-[#5a6975]"}>
                        {t.overdue ? "Overdue" : formatDue(t.due)}
                      </span>{" "}
                      · <Link href={`/opportunities/${t.opp.id}/sequence`} className="hover:underline">
                        {accountById.get(t.opp.account_id)?.name ?? "Account"}
                      </Link>{" "}
                      <span className="text-[#7a8794]">· Day {t.step.day} {t.step.channel}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </div>

        {/* 6. Deliberate switch to the rep's own view. Plain <a>: /view sets a cookie. */}
        <p className="mt-6 text-sm">
          <a href={`/view?as=${rep.id}`} className="text-[#3a728a] underline underline-offset-2 hover:text-[#142e3a]">
            View dashboard as {rep.name.split(" ")[0]} →
          </a>
        </p>
      </Page>
    </>
  );
}
