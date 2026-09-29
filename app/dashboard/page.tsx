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
import { currentWeek, expectedValue, inWeek, loadAll } from "@/lib/data";
import { eventLine, firstName, usd } from "@/lib/format";
import { matchAccounts } from "@/lib/match";
import { ACTED_STAGES, TYPE_MODULE } from "@/lib/types";
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
        <Header view={view} reps={null} active="dashboard" selected={String(repId)} />
        <Page>
          <ErrorBox>{loaded.error} The dashboard will load once the database is reachable.</ErrorBox>
        </Page>
      </>
    );
  }

  const { reps, accounts, signals, opps, settings } = loaded.data;
  const rep = reps.find((r) => r.id === repId && !r.is_manager);
  const header = <Header view={view} reps={reps} active={view.kind === "rep" ? "dashboard" : null} selected={String(repId)} />;
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
  const repSignals = signals.filter((s) => s.rep_id === rep.id && inWeek(s.week_of, week));
  const myAccounts = accounts.filter((a) => a.rep_id === rep.id);
  const weekSignalIds = new Set(repSignals.map((s) => s.id));
  const weekOpps = opps.filter((o) => weekSignalIds.has(o.signal_id));

  const pipeline = weekOpps.filter((o) => o.stage !== "lost").reduce((sum, o) => sum + o.amount, 0);
  const acted = weekOpps.filter((o) => ACTED_STAGES.includes(o.stage)).length;
  const capture = weekOpps.length ? (acted / weekOpps.length) * 100 : null;
  const hours = (weekOpps.length * MINUTES_PER_OPP) / 60;
  const history = settings.weekly_history[String(rep.id)];

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

        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div className="flex flex-col gap-2">
            <TerritoryMap territoryCounties={rep.counties} accounts={accounts} repId={rep.id} signals={repSignals} />
            <MapLegend />
          </div>

          <div className="flex flex-col gap-3">
            {repSignals.length === 0 ? (
              <EmptyState>No signals yet. Refresh to load this week&apos;s weather.</EmptyState>
            ) : (
              repSignals.map((s) => {
                const matches = matchAccounts(s, accounts);
                const sOpps = opps.filter((o) => o.signal_id === s.id);
                const acctCount = Math.max(matches.length, sOpps.length);
                const captured = sOpps.filter((o) => ACTED_STAGES.includes(o.stage));
                return (
                  <Card key={s.id} className="flex items-center gap-4 px-4 py-3 transition-shadow duration-150 hover:shadow-md">
                    <SignalIcon type={s.type} severity={s.severity} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/signals/${s.id}`} className="font-semibold hover:underline">
                        {eventLine(s)}
                      </Link>
                      <p className="text-sm text-[#3f4e5b]">
                        {acctCount} account{acctCount === 1 ? "" : "s"} · {TYPE_MODULE[s.type]} ·{" "}
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
                      <OutlineButtonLink href={`/pipeline?signal=${s.id}`}>{sOpps.length} opps ✓</OutlineButtonLink>
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
                  <CountUp value={pipeline} format="usd" />
                  <span className="ml-2 text-sm font-normal text-[#5a6975]">{weekOpps.length} opps</span>
                </p>
                {history && <Sparkline values={[...history.pipeline, pipeline]} color="#3a728a" label="Pipeline, last five weeks" />}
              </Tile>
              <Tile label="Capture rate">
                <p className="text-2xl font-bold text-[#1f9d55]">
                  {capture === null ? "—" : <CountUp value={capture} format="pct" />}
                </p>
                {history && (
                  <Sparkline
                    values={capture === null ? history.capture : [...history.capture, capture]}
                    color="#1f9d55"
                    label="Capture rate, last five weeks"
                  />
                )}
              </Tile>
              <Tile label="Hours saved" tint="#ffebdd">
                <p className="text-2xl font-bold text-[#c64800]">
                  <CountUp value={hours} format="hours" />
                </p>
                {history && <Sparkline values={[...history.hours, hours]} color="#c64800" label="Hours saved, last five weeks" />}
              </Tile>
            </div>
            <p className="text-xs text-[#7a8794]">
              Capture rate: opportunities acted on (pushed, sent or won) ÷ generated. Hours saved: 20 minutes of CRM typing
              per opportunity (an assumption). Earlier weeks in the sparklines are seeded.
            </p>
          </div>
        </div>
      </Page>
    </>
  );
}
