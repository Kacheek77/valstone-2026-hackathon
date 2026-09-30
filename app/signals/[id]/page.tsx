import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { LiveSignalTable, type LiveRow } from "@/components/LiveSignalTable";
import { SignalBackdrop } from "@/components/SignalBackdrop";
import { BackLink, ErrorBox, InfoTip, Page, SEVERITY_COLOR, SEVERITY_TINT } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { weekLabel } from "@/lib/format";
import { matchAccounts } from "@/lib/match";
import { amountFor } from "@/lib/pricing";
import { DEFAULT_THRESHOLD, isLead, type Account, type Opportunity, type SignalType } from "@/lib/types";

// VS-14 P1: view filters. 50+ is the app-wide lead line; the pills only filter this list.
const FILTERS = [
  { t: 0, label: "All" },
  { t: 50, label: "50+" },
  { t: 60, label: "60+" },
  { t: 80, label: "80+" },
];
import { DEMO_REP_ID, getView } from "@/lib/view";

export const dynamic = "force-dynamic";

const SIGNAL_ID = /^SIG-\d{4}$/;

const TYPE_LABEL: Record<SignalType, string> = {
  drought: "Drought worsened",
  rain: "Excess rain",
  heat: "Heat stress",
};

type Row = { account: Account; leadWith: string; opp: Opportunity | null; estimate: number };

export default async function SignalDetail(props: PageProps<"/signals/[id]">) {
  const { id } = await props.params;
  if (!SIGNAL_ID.test(id)) notFound();
  const sp = await props.searchParams;
  const tParam = Number(typeof sp.t === "string" ? sp.t : NaN);
  // Changing the threshold re-classifies rows; it never re-scores them.
  const filter = FILTERS.some((f) => f.t === tParam) ? tParam : DEFAULT_THRESHOLD;
  const threshold = DEFAULT_THRESHOLD;
  const view = await getView();

  const loaded = await loadAll();
  if (!loaded.ok) {
    return (
      <>
        <Header view={view} reps={null} active={null} />
        <Page>
          <ErrorBox>{loaded.error} This signal will load once the database is reachable.</ErrorBox>
        </Page>
      </>
    );
  }
  const { reps, accounts, signals, opps, settings } = loaded.data;
  const signal = signals.find((s) => s.id === id);
  if (!signal) notFound();
  // VS-12 T19: reps see only their own territory's signals.
  if (view.kind === "rep" && signal.rep_id !== view.repId) redirect(`/dashboard?rep=${view.repId}&note=territory`);

  const matches = matchAccounts(signal, accounts, reps);
  const sOpps = opps.filter((o) => o.signal_id === signal.id);
  const byAccount = new Map(sOpps.map((o) => [o.account_id, o]));

  const rows: Row[] = matches.map((m) => ({
    account: m.account,
    leadWith: byAccount.get(m.account.id)?.lead_with ?? m.leadWith,
    opp: byAccount.get(m.account.id) ?? null,
    estimate: amountFor(m.leadWith, m.account.acres, settings.price_list),
  }));
  // Opportunities whose account no longer matches still belong on the list.
  for (const o of sOpps) {
    if (rows.some((r) => r.account.id === o.account_id)) continue;
    const account = accounts.find((a) => a.id === o.account_id);
    if (account) rows.push({ account, leadWith: o.lead_with, opp: o, estimate: o.amount });
  }
  rows.sort((a, b) => {
    if (a.opp && b.opp) return b.opp.score - a.opp.score;
    if (a.opp) return -1;
    if (b.opp) return 1;
    return b.account.acres - a.account.acres;
  });

  const pending = rows.filter((r) => !r.opp).length;
  const leadCount = sOpps.filter((o) => isLead(o, threshold)).length;
  const liveRows: LiveRow[] = rows.map(({ account, leadWith, opp, estimate }) => ({
    accountId: account.id,
    name: account.name,
    place: `${account.county}, ${account.state}`,
    status: account.customer_status,
    crops: account.crops.join(", "),
    acres: account.acres,
    leadWith,
    estimate,
    opp: opp
      ? { id: opp.id, score: opp.score, why_now: opp.why_now, amount: opp.amount, lead_with: opp.lead_with, ai_offline: opp.ai_offline, promoted: opp.promoted === true }
      : null,
  }));
  const color = SEVERITY_COLOR[signal.severity];
  const backHref = view.kind === "manager" ? `/dashboard?rep=${signal.rep_id ?? DEMO_REP_ID}` : "/dashboard";
  const owner = reps.find((r) => r.id === signal.rep_id);

  return (
    <>
      <Header view={view} reps={reps} active={view.kind === "rep" ? "dashboard" : null} />
      <Page>
        <div className="mb-4">
          <BackLink href={backHref} label={view.kind === "manager" && owner ? `${owner.name}'s dashboard` : "Dashboard"} />
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start">
          <div className="relative flex-1 overflow-hidden rounded-xl border-l-[6px] px-5 py-4" style={{ background: SEVERITY_TINT[signal.severity], borderColor: color }}>
            <SignalBackdrop type={signal.type} />
            <div className="relative">
            <p className="text-sm text-[#5a6975]">
              {TYPE_LABEL[signal.type]} · <b style={{ color }}>{signal.severity}</b> · Week of {weekLabel(signal.week_of)}
              {owner ? ` · ${owner.territory_name}` : ""}
            </p>
            <h1 className="mt-1 text-xl font-bold leading-snug">{signal.headline}</h1>
            <p className="mt-2 leading-relaxed text-[#3f4e5b]">{signal.detail}</p>
            <p className="mt-2 text-sm text-[#5a6975]">Source: {signal.source}</p>
            </div>
          </div>
          {pending === 0 && leadCount > 0 && (
            <div className="md:pt-2">
              <Link
                href={`/pipeline?signal=${signal.id}`}
                className="inline-flex whitespace-nowrap rounded-full border-2 border-[#1f9d55] px-5 py-2 text-sm font-semibold text-[#1f9d55] transition-opacity duration-150 hover:opacity-80"
              >
                View {leadCount} lead{leadCount === 1 ? "" : "s"} →
              </Link>
            </div>
          )}
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 font-semibold text-[#3f4e5b]">
            Affected accounts, ranked
            <InfoTip label="How this works">
              Accounts in the county{signal.type === "drought" ? " (for drought, the whole territory)" : ""} with a relevant crop that do
              not yet own the module. Claude scores each one as the page opens; a rules-based score marked AI offline stands in if it
              cannot.
            </InfoTip>
          </h2>
          <nav className="flex items-center gap-2 text-sm" aria-label="Show accounts scoring">
            <span className="text-[#5a6975]">Show</span>
            {FILTERS.map(({ t, label }) => (
              <Link
                key={t}
                href={t === DEFAULT_THRESHOLD ? `/signals/${signal.id}` : `/signals/${signal.id}?t=${t}`}
                scroll={false}
                aria-current={t === filter ? "true" : undefined}
                className={`rounded-full px-3 py-1 transition-colors duration-150 ${
                  t === filter ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <LiveSignalTable
          signalId={signal.id}
          rows={liveRows}
          threshold={threshold}
          filter={filter}
          canPromote={view.kind === "rep"}
          county={signal.county}
          drought={signal.type === "drought"}
          prices={settings.price_list}
        />
      </Page>
    </>
  );
}
