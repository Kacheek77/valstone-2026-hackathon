import { CountUp } from "@/components/CountUp";
import { Header } from "@/components/Header";
import { Card, ErrorBox, Page, Tile } from "@/components/ui";
import { currentWeek, inWeek, loadAll } from "@/lib/data";
import { captureColor, pct, usd, weekLabel } from "@/lib/format";
import { captureRate, offTerritoryCount, signalDrivenShare, sumValues, timeToAct } from "@/lib/metrics";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

function hours(h: number | null): string {
  if (h === null) return "—";
  return h >= 48 ? `${(h / 24).toFixed(1)} d` : `${Math.round(h)} h`;
}

export default async function Team() {
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
  const weekSignals = data.signals.filter((s) => inWeek(s.week_of, week));
  const team = sumValues(weekSignals, data);
  const teamCapture = captureRate(team);

  const rows = salesReps.map((rep) => {
    const signals = weekSignals.filter((s) => s.rep_id === rep.id);
    const v = sumValues(signals, data);
    return {
      rep,
      signals: signals.length,
      opps: v.generated,
      value: v,
      capture: captureRate(v),
      tta: timeToAct(rep.id, data),
      offTerritory: offTerritoryCount(rep.id, data),
      signalDriven: signalDrivenShare(rep.id, data),
    };
  });

  return (
    <>
      <Header view={view} reps={data.reps} active="team" selected="manager" />
      <Page>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Plains region · {salesReps.length} reps · week of {week ? weekLabel(week) : "—"}
            </h1>
            <p className="text-[#5a6975]">Performance against the opportunity the weather created, not against a flat quota</p>
          </div>
          <div className="flex gap-2 text-sm" role="group" aria-label="Period">
            <span className="rounded-full bg-[#3a728a] px-4 py-1.5 font-medium text-white">This week</span>
            {["4 weeks", "Season"].map((p) => (
              <button
                key={p}
                type="button"
                disabled
                title="Season view in backlog"
                className="cursor-not-allowed rounded-full border border-[#bcc4cb] px-4 py-1.5 text-[#9aa5ae]"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Signals, all territories">
            <p className="text-2xl font-bold text-[#3a728a]"><CountUp value={weekSignals.length} format="int" /></p>
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
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[#efefef] text-[#3f4e5b]">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Rep</th>
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
                <th className="px-4 py-2.5 text-right font-semibold" title="Share of open pipeline dollars that came from a signal">
                  Signal-driven
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rep.id} className="relative border-t border-[#eef0f2] transition-colors duration-150 hover:bg-[#f6f7f8]">
                  <td className="px-4 py-3 font-semibold text-[#3a728a]">
                    {/* Plain <a>: /view sets the cookie. The ::after stretches the link over the whole row. */}
                    <a href={`/view?as=${r.rep.id}`} className="after:absolute after:inset-0 hover:underline">
                      {r.rep.name}
                    </a>
                  </td>
                  <td className="px-3 py-3">{r.rep.territory_name}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.signals}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.opps}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.value.available > 0 ? usd(r.value.available) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.value.available > 0 ? usd(r.value.captured) : "—"}</td>
                  <td className={`px-3 py-3 text-right font-bold tabular-nums ${captureColor(r.capture)}`}>
                    {r.capture !== null && <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current" />}
                    {pct(r.capture)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{hours(r.tta)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${r.offTerritory > 1 ? "font-semibold text-[#c47d00]" : ""}`}>
                    {r.offTerritory}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{pct(r.signalDriven)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-3 text-xs text-[#7a8794]">
          Click a rep to open their dashboard. Available = Σ amount × score ÷ 100 over this week&apos;s generated opportunities,
          plus, for any signal with no opportunities at all, its matched accounts at a score of 50, so an ignored signal
          still counts against the rep.
          Captured = the same over those pushed, sent or won. Capture rate: green 70%+, amber 50–69%, red under 50%. Time to
          act: median hours from a signal&apos;s week to the CRM push, across all weeks. Off-territory and signal-driven cover
          all of the rep&apos;s opportunities; signal-driven is weighted by open pipeline dollars. Score is a model estimate
          until a season of closes calibrates it.
        </p>
      </Page>
    </>
  );
}
