import Link from "next/link";
import { redirect } from "next/navigation";
import { CountUp } from "@/components/CountUp";
import { CardGenerateButton } from "@/components/GenerateButton";
import { Header } from "@/components/Header";
import { RefreshButton } from "@/components/RefreshButton";
import { TaskDoneButton } from "@/components/TaskDoneButton";
import { Sparkline } from "@/components/Sparkline";
import { MapLegend, TerritoryMap } from "@/components/TerritoryMap";
import {
  Card,
  EmptyState,
  ErrorBox,
  InfoTip,
  OutlineButtonLink,
  Page,
  SignalIcon,
  Tile,
} from "@/components/ui";
import { currentWeek, inWeek, loadAll, type AllData } from "@/lib/data";
import { eventLine, firstName, usd, weekLabel } from "@/lib/format";
import { matchAccounts } from "@/lib/match";
import { captureRate, expectedValue, signalWeeks, sumValues } from "@/lib/metrics";
import { formatDue, tasksDue } from "@/lib/steps";
import { isLead, type Opportunity, type Signal } from "@/lib/types";
import { getView, parseView } from "@/lib/view";

export const dynamic = "force-dynamic";

const MINUTES_PER_OPP = 20;

const PERIODS = [
  { key: "week", label: "This week", days: 7, phrase: "this week" },
  { key: "4w", label: "4 weeks", days: 28, phrase: "in the last 4 weeks" },
  { key: "season", label: "Season", days: Infinity, phrase: "this season" },
] as const;

function inPeriod(weekOf: string, current: string | null, days: number): boolean {
  if (!current) return false;
  const diff = (Date.parse(current) - Date.parse(weekOf)) / 86_400_000;
  return diff >= 0 && diff < days;
}

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
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[0];
  const periodHref = (key: string) => {
    const q = new URLSearchParams({ rep: repId });
    if (key !== "week") q.set("period", key);
    if (demo) q.set("demo", "1");
    return `/dashboard?${q}`;
  };

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
  // The period decides what the map, cards and tiles show.
  const repSignals = repAllSignals.filter((s) => inPeriod(s.week_of, week, period.days));
  const myAccounts = accounts.filter((a) => a.rep_id === rep.id);
  const tasks = tasksDue(data, rep.id);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
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
              {repSignals.length === 1 ? "" : "s"} {period.phrase}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex gap-2 text-sm" aria-label="Period">
              {PERIODS.map((p) => (
                <Link
                  key={p.key}
                  href={periodHref(p.key)}
                  className={`rounded-full px-4 py-1.5 transition-colors duration-150 ${
                    p.key === period.key ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"
                  }`}
                >
                  {p.label}
                </Link>
              ))}
            </nav>
            <RefreshButton demo={demo} />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,400px)_1fr]">
          <div className="flex flex-col gap-2">
            <TerritoryMap territoryCounties={rep.counties} accounts={accounts} repId={rep.id} signals={repSignals} />
            <MapLegend />
          </div>

          <div className="flex flex-col gap-3">
            {repSignals.length === 0 ? (
              <EmptyState>
                {period.key === "week" ? "No signals yet. Refresh to load this week's weather." : `No signals ${period.phrase}.`}
              </EmptyState>
            ) : (
              repSignals.map((s) => {
                const matches = matchAccounts(s, accounts, reps);
                const sOpps = opps.filter((o) => o.signal_id === s.id);
                const leads = sOpps.filter((o) => isLead(o));
                const below = sOpps.length - leads.length;
                const acctCount = new Set([...matches.map((m) => m.account.id), ...sOpps.map((o) => o.account_id)]).size;
                return (
                  <Card key={s.id} className="flex items-center gap-4 px-4 py-3 transition-shadow duration-150 hover:shadow-md">
                    <SignalIcon type={s.type} severity={s.severity} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/signals/${s.id}`} className="font-semibold hover:underline">
                        {eventLine(s)}
                      </Link>
                      <p className="text-sm text-[#3f4e5b]">
                        {sOpps.length === 0 ? (
                          <>
                            {acctCount} account{acctCount === 1 ? "" : "s"} · {s.target_module} ·{" "}
                            <span className="text-[#7a8794]">not generated</span>
                          </>
                        ) : (
                          <>
                            {leads.length} lead{leads.length === 1 ? "" : "s"}
                            {below > 0 && <span className="text-[#7a8794]"> · {below} below threshold</span>} · {s.target_module} ·{" "}
                            <b>{usd(expectedValue(leads.length ? leads : sOpps))} expected</b>
                          </>
                        )}
                        {period.key !== "week" && <span className="text-[#7a8794]"> · {weekLabel(s.week_of)}</span>}
                      </p>
                    </div>
                    {sOpps.length === 0 && matches.length > 0 ? (
                      <CardGenerateButton signalId={s.id} pendingAccountIds={matches.map((m) => m.account.id)} />
                    ) : sOpps.length === 0 ? (
                      <OutlineButtonLink href={`/signals/${s.id}`} color="#7a8794">
                        Review
                      </OutlineButtonLink>
                    ) : leads.length > 0 ? (
                      <OutlineButtonLink href={`/pipeline?signal=${s.id}`}>
                        View {leads.length} lead{leads.length === 1 ? "" : "s"}
                      </OutlineButtonLink>
                    ) : (
                      <OutlineButtonLink href={`/signals/${s.id}`} color="#7a8794">
                        Review
                      </OutlineButtonLink>
                    )}
                  </Card>
                );
              })
            )}

            <div className="mt-1 flex flex-col gap-3 sm:flex-row">
              <Tile label={`Pipeline, ${period.label.toLowerCase()}`}>
                <p className="text-2xl font-bold text-[#3a728a]">
                  <CountUp value={now.pipeline} format="usd" />
                  <span className="ml-2 text-sm font-normal text-[#5a6975]">
                    {now.opps.length} opp{now.opps.length === 1 ? "" : "s"}
                  </span>
                </p>
                <Sparkline values={series((n) => n.pipeline)} color="#3a728a" label="Pipeline, last five weeks" />
              </Tile>
              <Tile
                label={
                  <span className="flex items-center gap-1.5">
                    Capture rate
                    <InfoTip label="How capture rate is calculated">
                      Expected value you accepted, sent or won, divided by the expected value the weather created: every generated
                      opportunity at amount × score, plus, for any signal you have not generated at all, its matched accounts at a
                      score of 50.
                    </InfoTip>
                  </span>
                }
              >
                <p className="text-2xl font-bold text-[#1f9d55]">
                  {now.capture === null ? "—" : <CountUp value={now.capture} format="pct" />}
                </p>
                <Sparkline values={series((n) => n.capture)} color="#1f9d55" label="Capture rate, last five weeks" />
              </Tile>
              <Tile
                label={
                  <span className="flex items-center gap-1.5">
                    Hours saved
                    <InfoTip label="How hours saved is estimated" align="right">
                      Opportunities generated × 20 minutes: the research, record, note, task and email a rep would otherwise do by hand.
                      The 20 minutes is an estimate, not a measurement.
                    </InfoTip>
                  </span>
                }
                tint="#ffebdd"
              >
                <p className="text-2xl font-bold text-[#c64800]">
                  <CountUp value={now.hours} format="hours" />
                </p>
                <Sparkline values={series((n) => n.hours)} color="#c64800" label="Hours saved, last five weeks" />
              </Tile>
            </div>
            <p className="text-xs text-[#7a8794]">Sparklines show the four prior weeks of seeded history, then this week.</p>

            <Card className="px-4 py-3">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-semibold">My tasks</h2>
                <span className="text-xs text-[#7a8794]">Scheduled outreach due in the next 7 days</span>
              </div>
              {tasks.length === 0 ? (
                <p className="text-sm text-[#7a8794]">
                  Nothing due. Accept a lead, then Build sequence and Schedule all on its sequence page.
                </p>
              ) : (
                <ul className="divide-y divide-[#eef0f2]">
                  {tasks.map((t) => (
                    <li key={t.step.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className={`w-24 shrink-0 whitespace-nowrap ${t.overdue ? "font-semibold text-[#d23b3b]" : "text-[#5a6975]"}`}>
                        {t.overdue ? "Overdue" : formatDue(t.due)}
                      </span>
                      <Link href={`/opportunities/${t.opp.id}/sequence`} className="min-w-0 flex-1 truncate hover:underline">
                        <span className="font-medium">{accountName.get(t.opp.account_id) ?? "Account"}</span>
                        <span className="text-[#5a6975]"> · Day {t.step.day} {t.step.channel} · {t.step.title}</span>
                      </Link>
                      <TaskDoneButton stepId={t.step.id} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </Page>
    </>
  );
}
