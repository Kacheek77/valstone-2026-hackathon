import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { Header } from "@/components/Header";
import { hoursLabel } from "@/components/hoursLabel";
import { Card, ErrorBox, Page, Tile } from "@/components/ui";
import { currentWeek, loadAll } from "@/lib/data";
import { captureColor, pct, usd, weekLabel } from "@/lib/format";
import { captureRate, periodFor, periodSignals, PERIODS, sumValues, teamRow } from "@/lib/metrics";
import { tasksDue } from "@/lib/steps";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function Team(props: PageProps<"/team">) {
  const sp = await props.searchParams;
  const period = periodFor(sp.period);
  const periodQuery = period.key === "week" ? "" : `?period=${period.key}`;
  const view = await getView();
  const loaded = await loadAll();
  if (!loaded.ok) {
    return (
      <>
        <Header view={view} reps={null} active="team" selected="manager" />
        <Page>
          <ErrorBox>{loaded.error} The team view will load once the database is reachable.</ErrorBox>
        </Page>
      </>
    );
  }

  const data = loaded.data;
  const salesReps = data.reps.filter((r) => !r.is_manager);
  const week = currentWeek(data.signals);
  const allSignals = periodSignals(data.signals, period);
  const team = sumValues(allSignals, data);
  const teamCapture = captureRate(team);

  const rows = salesReps.map((rep) => ({ rep, ...teamRow(rep.id, data, period), tasksDue: tasksDue(data, rep.id).length }));

  return (
    <>
      <Header view={view} reps={data.reps} active="team" selected="manager" />
      <Page>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Plains region · {salesReps.length} reps · {period.key === "week" ? `week of ${week ? weekLabel(week) : "—"}` : period.phrase}
            </h1>
            <p className="text-[#5a6975]">Performance against the opportunity the weather created, not against a flat quota</p>
          </div>
          <nav className="flex gap-2 text-sm" aria-label="Period">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={p.key === "week" ? "/team" : `/team?period=${p.key}`}
                className={`rounded-full px-4 py-1.5 transition-colors duration-150 ${
                  p.key === period.key ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Signals, all territories">
            <p className="text-2xl font-bold text-[#3a728a]"><CountUp value={allSignals.length} format="int" /></p>
          </Tile>
          <Tile label="Expected value available">
            <p className="text-2xl font-bold text-[#3a728a]"><CountUp value={team.available} format="usd" /></p>
          </Tile>
          <Tile label="Expected value captured">
            <p className="text-2xl font-bold text-[#3a728a]"><CountUp value={team.captured} format="usd" /></p>
          </Tile>
          <Tile label="Team capture rate" tint="#ffebdd">
            <p className="text-2xl font-bold text-[#c64800]">
              {teamCapture === null ? "—" : <CountUp value={teamCapture} format="pct" />}
            </p>
          </Tile>
        </div>

        <Card className="overflow-x-auto">
          <table className="w-full min-w-[1060px] text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="bg-[#efefef] text-[#3f4e5b]">
              <tr>
                <th className="sticky left-0 z-20 bg-[#efefef] px-4 py-2.5 text-left font-semibold">Rep</th>
                <th className="px-3 py-2.5 text-left font-semibold">Territory</th>
                <th className="px-3 py-2.5 text-right font-semibold">Signals</th>
                <th className="px-3 py-2.5 text-right font-semibold">Opps</th>
                <th className="px-3 py-2.5 text-right font-semibold">Available</th>
                <th className="px-3 py-2.5 text-right font-semibold">Captured</th>
                <th className="px-3 py-2.5 text-right font-semibold">Capture</th>
                <th className="px-3 py-2.5 text-right font-semibold">Time to act</th>
                <th className="px-3 py-2.5 text-right font-semibold" title="Opportunities on accounts outside the rep's counties, all weeks">
                  Off-territory
                </th>
                <th className="px-3 py-2.5 text-right font-semibold" title="Share of open pipeline dollars that came from a signal">
                  Signal-driven
                </th>
                <th className="px-4 py-2.5 text-right font-semibold" title="Scheduled outreach steps due in the next 7 days, overdue included">
                  Tasks due
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rep.id} className="group relative border-t border-[#eef0f2] transition-colors duration-150 hover:bg-[#f6f7f8]">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 font-semibold text-[#3a728a] shadow-[1px_0_0_#eef0f2] transition-colors duration-150 group-hover:bg-[#f6f7f8]">
                    {/* VS-9: drill in as the manager; the ::after stretches the link over the whole row. */}
                    <Link href={`/team/${r.rep.id}${periodQuery}`} className="after:absolute after:inset-0 hover:underline">
                      {r.rep.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{r.rep.territory_name}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.signals.length}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.value.generated}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.value.available > 0 ? usd(r.value.available) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.value.available > 0 ? usd(r.value.captured) : "—"}</td>
                  <td className={`whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums ${captureColor(r.capture)}`}>
                    {r.capture !== null && <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current" />}
                    {pct(r.capture)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{hoursLabel(r.tta)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${r.offTerritory > 1 ? "font-semibold text-[#c47d00]" : ""}`}>
                    {r.offTerritory}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{pct(r.signalDriven)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.tasksDue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-3 text-xs text-[#7a8794]">
          Click a rep for their summary. Available = Σ amount × score ÷ 100 over the period&apos;s generated opportunities,
          plus, for any signal with no opportunities at all, its matched accounts at a score of 50, so an ignored signal
          still counts against the rep. Captured = the same over those accepted, sent or won. Capture rate: green 70%+, amber
          50–69%, red under 50%. Time to act = signal to accept: median hours from a signal&apos;s week to the rep accepting the
          lead, across all weeks. Off-territory and signal-driven cover all of the rep&apos;s opportunities; signal-driven is
          weighted by open pipeline dollars. Score is a model estimate until a season of closes calibrates it.
        </p>
      </Page>
    </>
  );
}
