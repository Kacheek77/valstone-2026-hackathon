import Link from "next/link";
import { redirect } from "next/navigation";
import { CountUp } from "@/components/CountUp";
import { Header } from "@/components/Header";
import { RefreshButton } from "@/components/RefreshButton";
import { Sparkline } from "@/components/Sparkline";
import { MapLegend, TerritoryMap } from "@/components/TerritoryMap";
import {
  Card,
  EmptyState,
  ErrorBox,
  OutlineButtonLink,
  Page,
  PrimaryButtonLink,
  SignalIcon,
  Tile,
} from "@/components/ui";
import { currentWeek, inWeek, loadAll, type AllData } from "@/lib/data";
import { eventLine, firstName, usd } from "@/lib/format";
import { matchAccounts } from "@/lib/match";
import { captureRate, expectedValue, signalWeeks, sumValues } from "@/lib/metrics";
import { ACTED_STAGES, type Opportunity, type Signal } from "@/lib/types";
import { getView, parseView } from "@/lib/view";

export const dynamic = "force-dynamic";

const MINUTES_PER_OPP = 20;

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type WeekNumbers = { pipeline: number; capture: number | null; hours: number; opps: Opportunity[] };

function weekNumbers(signals: Signal[], data: AllData): WeekNumbers {
  const ids = new Set(signals.map((s) => s.id));
  const opps = data.opps.filter((o) => o.signal_id && ids.has(o.signal_id));
  return {
    pipeline: opps.filter((o) => o.stage !== "lost").reduce((sum, o) => sum + o.amount, 0),
    capture: captureRate(sumValues(signals, data)),
    hours: (opps.length * MINUTES_PER_OPP) / 60,
    opps,
  };
}

export default async function Dashboard(props: PageProps<"/dashboard">) {
  const sp = await props.searchParams;
  const view = await getView();
  const override = parseView(typeof sp.rep === "string" ? sp.rep : null);
  const repId = override?.kind === "rep" ? override.repId : view.kind === "rep" ? view.repId : null;
  if (repId === null) redirect("/team");
  const demo = sp.demo === "1";

  const loaded = await loadAll();
  if (!loaded.ok) {
    return (
      <>
        <Header view={view} reps={null} active="dashboard" selected={repId} />
        <Page>
          <ErrorBox>{loaded.error} The dashboard will load once the database is reachable.</ErrorBox>
        </Page>
      </>
    );
  }

  const data = loaded.data;
  const { reps, accounts, signals, opps } = data;
  const rep = reps.find((r) => r.id === repId && !r.is_manager);
  const header = <Header view={view} reps={reps} active={view.kind === "rep" ? "dashboard" : null} selected={repId} />;
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

  const week = currentWeek(signals);
  const repAllSignals = signals.filter((s) => s.rep_id === rep.id);
  const repSignals = repAllSignals.filter((s) => inWeek(s.week_of, week));
  const myAccounts = accounts.filter((a) => a.rep_id === rep.id);
  const now = weekNumbers(repSignals, data);

  // Sparklines: the four weeks before this one, from the seeded history, then this week.
  const priorWeeks = signalWeeks(signals).filter((w) => !inWeek(w, week)).slice(-4);
  const history = priorWeeks.map((w) => weekNumbers(repAllSignals.filter((s) => s.week_of === w), data));
  const series = (pick: (n: WeekNumbers) => number | null) =>
    [...history, now].map(pick).filter((v): v is number => v !== null);

  return (
    <>
      {header}
      <Page>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {greeting()}, {firstName(rep.name)}.
            </h1>
            <p className="text-[#5a6975]">
              {rep.territory_name} · {myAccounts.length} accounts · {repSignals.length} signal
              {repSignals.length === 1 ? "" : "s"} this week
            </p>
          </div>
          <RefreshButton demo={demo} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,400px)_1fr]">
          <div className="flex flex-col gap-2">
            <TerritoryMap territoryCounties={rep.counties} accounts={accounts} repId={rep.id} signals={repSignals} />
            <MapLegend />
          </div>

          <div className="flex flex-col gap-3">
            {repSignals.length === 0 ? (
              <EmptyState>No signals yet. Refresh to load this week&apos;s weather.</EmptyState>
            ) : (
              repSignals.map((s) => {
                const matches = matchAccounts(s, accounts, reps);
                const sOpps = opps.filter((o) => o.signal_id === s.id);
                const acctCount = new Set([...matches.map((m) => m.account.id), ...sOpps.map((o) => o.account_id)]).size;
                const captured = sOpps.filter((o) => ACTED_STAGES.includes(o.stage));
                return (
                  <Card key={s.id} className="flex items-center gap-4 px-4 py-3 transition-shadow duration-150 hover:shadow-md">
                    <SignalIcon type={s.type} severity={s.severity} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/signals/${s.id}`} className="font-semibold hover:underline">
                        {eventLine(s)}
                      </Link>
                      <p className="text-sm text-[#3f4e5b]">
                        {acctCount} account{acctCount === 1 ? "" : "s"} · {s.target_module} ·{" "}
                        {sOpps.length === 0 ? (
                          <span className="text-[#7a8794]">— expected</span>
                        ) : captured.length === sOpps.length ? (
                          <b>{usd(expectedValue(sOpps))} captured</b>
                        ) : (
                          <b>{usd(expectedValue(sOpps))} expected</b>
                        )}
                      </p>
                    </div>
                    {sOpps.length > 0 ? (
                      <OutlineButtonLink href={`/pipeline?signal=${s.id}`}>
                        {sOpps.length} opp{sOpps.length === 1 ? "" : "s"} ✓
                      </OutlineButtonLink>
                    ) : (
                      <PrimaryButtonLink href={`/signals/${s.id}`}>Generate →</PrimaryButtonLink>
                    )}
                  </Card>
                );
              })
            )}

            <div className="mt-1 flex flex-col gap-3 sm:flex-row">
              <Tile label="Pipeline this week">
                <p className="text-2xl font-bold text-[#3a728a]">
                  <CountUp value={now.pipeline} format="usd" />
                  <span className="ml-2 text-sm font-normal text-[#5a6975]">
                    {now.opps.length} opp{now.opps.length === 1 ? "" : "s"}
                  </span>
                </p>
                <Sparkline values={series((n) => n.pipeline)} color="#3a728a" label="Pipeline, last five weeks" />
              </Tile>
              <Tile label="Capture rate">
                <p className="text-2xl font-bold text-[#1f9d55]">
                  {now.capture === null ? "—" : <CountUp value={now.capture} format="pct" />}
                </p>
                <Sparkline values={series((n) => n.capture)} color="#1f9d55" label="Capture rate, last five weeks" />
              </Tile>
              <Tile label="Hours saved" tint="#ffebdd">
                <p className="text-2xl font-bold text-[#c64800]">
                  <CountUp value={now.hours} format="hours" />
                </p>
                <Sparkline values={series((n) => n.hours)} color="#c64800" label="Hours saved, last five weeks" />
              </Tile>
            </div>
            <p className="text-xs text-[#7a8794]">
              Capture rate: expected value pushed, sent or won ÷ expected value available, where available includes matched
              accounts not yet generated (valued at a score of 50). Hours saved: 20 minutes of CRM typing per opportunity (an
              assumption). Sparklines show the four prior weeks of seeded history, then this week.
            </p>
          </div>
        </div>
      </Page>
    </>
  );
}
