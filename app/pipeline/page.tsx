import Link from "next/link";
import { Header } from "@/components/Header";
import { BackLink, Card, EmptyState, ErrorBox, Page, StageBadge } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { dateTime, eventLine, usdExact, weekLabel } from "@/lib/format";
import { isLead, OPEN_STAGES, type Stage } from "@/lib/types";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

const STAGE_PILLS: { key: "all" | Stage; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "pushed", label: "Pushed" },
  { key: "sent", label: "Sent" },
  { key: "won", label: "Won" },
];

export default async function Pipeline(props: PageProps<"/pipeline">) {
  const sp = await props.searchParams;
  const signalFilter = typeof sp.signal === "string" ? sp.signal : null;
  const stageParam = typeof sp.stage === "string" ? sp.stage : "all";
  const stage = STAGE_PILLS.some((p) => p.key === stageParam) ? (stageParam as "all" | Stage) : "all";
  const showBelow = sp.below === "1";
  const view = await getView();

  const loaded = await loadAll();
  if (!loaded.ok) {
    return (
      <>
        <Header view={view} reps={null} active="pipeline" />
        <Page>
          <ErrorBox>{loaded.error} The pipeline will load once the database is reachable.</ErrorBox>
        </Page>
      </>
    );
  }

  const { reps, accounts, signals, opps } = loaded.data;
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const signalById = new Map(signals.map((s) => [s.id, s]));
  const repById = new Map(reps.map((r) => [r.id, r]));
  const filterSignal = signalFilter ? signalById.get(signalFilter) : undefined;

  const scoped = opps
    .filter((o) => view.kind === "manager" || o.rep_id === view.repId)
    .filter((o) => !signalFilter || o.signal_id === signalFilter);
  const belowCount = scoped.filter((o) => !isLead(o)).length;
  const inView = scoped.filter((o) => showBelow || isLead(o));
  const counts = Object.fromEntries(
    STAGE_PILLS.map((p) => [p.key, p.key === "all" ? inView.length : inView.filter((o) => o.stage === p.key).length]),
  );
  const visible = inView.filter((o) => stage === "all" || o.stage === stage).sort((a, b) => b.score - a.score);
  const openTotal = inView.filter((o) => OPEN_STAGES.includes(o.stage)).reduce((s, o) => s + o.amount, 0);

  const href = (next: { stage?: string; below?: boolean; signal?: string | null }) => {
    const q = new URLSearchParams();
    const sig = next.signal === undefined ? signalFilter : next.signal;
    if (sig) q.set("signal", sig);
    const st = next.stage ?? stage;
    if (st !== "all") q.set("stage", st);
    if (next.below ?? showBelow) q.set("below", "1");
    const s = q.toString();
    return s ? `/pipeline?${s}` : "/pipeline";
  };

  return (
    <>
      <Header view={view} reps={reps} active="pipeline" />
      <Page>
        {filterSignal && (
          <div className="mb-3">
            <BackLink href={`/signals/${filterSignal.id}`} label={filterSignal.headline} />
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Generated leads</h1>
          {signalFilter && (
            <Link
              href={href({ signal: null })}
              className="rounded-full bg-[#e3eef4] px-3 py-1 text-sm text-[#3a728a] transition-colors duration-150 hover:bg-[#cee5f3]"
            >
              {filterSignal ? eventLine(filterSignal) : "One signal"} · clear ×
            </Link>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-2" aria-label="Stage">
            {STAGE_PILLS.map((p) => (
              <Link
                key={p.key}
                href={href({ stage: p.key })}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-150 ${
                  stage === p.key ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"
                }`}
              >
                {p.label} <span className="opacity-70">{counts[p.key]}</span>
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {belowCount > 0 && (
              <Link href={href({ below: !showBelow })} className="text-[#3a728a] underline underline-offset-2 hover:text-[#142e3a]">
                {showBelow ? `Hide below threshold (${belowCount})` : `Show below threshold (${belowCount})`}
              </Link>
            )}
            <p className="text-[#3f4e5b]">
              Open pipeline: <b className="tabular-nums">{usdExact(openTotal)}</b>
            </p>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState>
            {scoped.length === 0
              ? "No leads yet. Open a signal from the dashboard and click Generate leads."
              : "Nothing in this stage. Pick another stage above."}
          </EmptyState>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[#efefef] text-left text-[#3f4e5b]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Score</th>
                  <th className="px-3 py-2.5 font-semibold">Account</th>
                  {view.kind === "manager" && <th className="px-3 py-2.5 font-semibold">Rep</th>}
                  <th className="px-3 py-2.5 font-semibold">Signal</th>
                  <th className="px-3 py-2.5 font-semibold">Module</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2.5 font-semibold">Stage</th>
                  <th className="px-3 py-2.5 font-semibold">Created</th>
                  <th className="px-4 py-2.5" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => {
                  const s = o.signal_id ? signalById.get(o.signal_id) : undefined;
                  const below = !isLead(o);
                  return (
                    <tr
                      key={o.id}
                      className={`relative border-t border-[#eef0f2] transition-colors duration-150 hover:bg-[#f6f7f8] ${below ? "text-[#9aa5ae]" : ""}`}
                    >
                      <td className="px-4 py-3 font-bold tabular-nums text-[#3a728a]">
                        {o.score}
                        {o.promoted && <span className="ml-1 text-xs font-normal text-[#1f9d55]" title="Promoted to lead">↑</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/opportunities/${o.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">
                          {accountById.get(o.account_id)?.name ?? "Unknown account"}
                        </Link>
                      </td>
                      {view.kind === "manager" && <td className="px-3 py-3">{repById.get(o.rep_id ?? "")?.name ?? "—"}</td>}
                      <td className="px-3 py-3">
                        {s ? `${eventLine(s)} · ${weekLabel(s.week_of)}` : <span className="text-[#7a8794]">List prospecting</span>}
                      </td>
                      <td className="px-3 py-3">{o.lead_with}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{usdExact(o.amount)}</td>
                      <td className="px-3 py-3"><StageBadge stage={o.stage} /></td>
                      <td className="whitespace-nowrap px-3 py-3 text-[#5a6975]">{dateTime(o.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/opportunities/${o.id}`}
                          className="relative z-10 inline-flex whitespace-nowrap rounded-full border border-[#3a728a] px-3 py-1 text-xs font-semibold text-[#3a728a] transition-colors duration-150 hover:bg-[#3a728a] hover:text-white"
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
        <p className="mt-3 text-xs text-[#7a8794]">
          Leads are opportunities scoring 50 or more, plus any a rep promoted. Open pipeline counts Draft, Pushed and Sent in
          the current view.
        </p>
      </Page>
    </>
  );
}
