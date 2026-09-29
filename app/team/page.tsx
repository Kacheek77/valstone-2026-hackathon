import { CountUp } from "@/components/CountUp";
import { Header } from "@/components/Header";
import { Card, ErrorBox, Page, Tile } from "@/components/ui";
import { currentWeek, expectedValue, inWeek, loadAll } from "@/lib/data";
import { captureColor, median, pct, usd, weekLabel } from "@/lib/format";
import { ACTED_STAGES } from "@/lib/types";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

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

  const { reps, signals, opps } = loaded.data;
  const salesReps = reps.filter((r) => !r.is_manager);
  const week = currentWeek(signals);
  const weekSignals = signals.filter((s) => inWeek(s.week_of, week));
  const signalById = new Map(weekSignals.map((s) => [s.id, s]));
  const weekOpps = opps.filter((o) => signalById.has(o.signal_id));
  const captured = (list: typeof weekOpps) => list.filter((o) => ACTED_STAGES.includes(o.stage));

  const available = expectedValue(weekOpps);
  const capturedValue = expectedValue(captured(weekOpps));
  const teamCapture = available > 0 ? (capturedValue / available) * 100 : null;

  const rows = salesReps.map((rep) => {
    const repOpps = weekOpps.filter((o) => o.rep_id === rep.id);
    const avail = expectedValue(repOpps);
    const cap = expectedValue(captured(repOpps));
    const hoursToAct = captured(repOpps)
      .filter((o) => o.pushed_at)
      .map((o) => {
        const s = signalById.get(o.signal_id)!;
        return (Date.parse(o.pushed_at!) - Date.parse(`${s.week_of}T00:00:00Z`)) / 3_600_000;
      });
    const tta = median(hoursToAct);
    return {
      rep,
      signals: weekSignals.filter((s) => s.rep_id === rep.id).length,
      opps: repOpps.length,
      avail,
      cap,
      capture: avail > 0 ? (cap / avail) * 100 : null,
      tta,
    };
  });

  return (
    <>
      <Header view={view} reps={reps} active="team" selected="manager" />
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
            <p className="text-2xl font-bold text-[#3a728a]"><CountUp value={available} format="usd" /></p>
          </Tile>
          <Tile label="Expected value captured">
            <p className="text-2xl font-bold text-[#3a728a]"><CountUp value={capturedValue} format="usd" /></p>
          </Tile>
          <Tile label="Team capture rate" tint="#ffebdd">
            <p className="text-2xl font-bold text-[#c64800]">
              {teamCapture === null ? "—" : <CountUp value={teamCapture} format="pct" />}
            </p>
          </Tile>
        </div>

        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[#efefef] text-[#3f4e5b]">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Rep</th>
                <th className="px-3 py-2.5 text-left font-semibold">Territory</th>
                <th className="px-3 py-2.5 text-right font-semibold">Signals</th>
                <th className="px-3 py-2.5 text-right font-semibold">Opps</th>
                <th className="px-3 py-2.5 text-right font-semibold">Available</th>
                <th className="px-3 py-2.5 text-right font-semibold">Captured</th>
                <th className="px-3 py-2.5 text-right font-semibold">Capture</th>
                <th className="px-4 py-2.5 text-right font-semibold">Time to act</th>
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
                  <td className="px-3 py-3 text-right tabular-nums">{r.opps ? usd(r.avail) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.opps ? usd(r.cap) : "—"}</td>
                  <td className={`px-3 py-3 text-right font-bold tabular-nums ${captureColor(r.capture)}`}>
                    {r.capture !== null && <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current" />}
                    {pct(r.capture)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.tta === null ? "—" : `${Math.round(r.tta)} h`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-3 text-xs text-[#7a8794]">
          Click a rep to open their dashboard. Available = Σ amount × score ÷ 100 over the week&apos;s opportunities; captured =
          the same over those pushed, sent or won. Capture rate: green 70%+, amber 50–69%, red under 50%. Time to act: median
          hours from the signal&apos;s week to the CRM push. Score is a model estimate until a season of closes calibrates it.
        </p>
      </Page>
    </>
  );
}
