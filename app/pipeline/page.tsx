import { Header } from "@/components/Header";
import { PipelineClient, type PipelineRow, type SignalOption } from "@/components/PipelineClient";
import { BackLink, ErrorBox, Page } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { dateTime, eventLine, weekLabel } from "@/lib/format";
import { stepProgress } from "@/lib/steps";
import { amountExplain } from "@/lib/pricing";
import { isLead, RESPONSE_LABEL } from "@/lib/types";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

// Server side gathers the rows; search, filters, sort and stage pills run in
// the browser (tweak 5), since the list is small.
export default async function Pipeline(props: PageProps<"/pipeline">) {
  const sp = await props.searchParams;
  const signalFilter = typeof sp.signal === "string" && /^SIG-\d{4}$/.test(sp.signal) ? sp.signal : null;
  // VS-8: the map's account drawer links here with ?q=<account name>.
  const initialQuery = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
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

  const { reps, accounts, signals, opps, steps, settings } = loaded.data;
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const signalById = new Map(signals.map((s) => [s.id, s]));
  const repById = new Map(reps.map((r) => [r.id, r]));
  const filterSignal = signalFilter ? signalById.get(signalFilter) : undefined;

  const scoped = opps.filter((o) => view.kind === "manager" || o.rep_id === view.repId);
  const rows: PipelineRow[] = scoped.map((o) => {
    const s = o.signal_id ? signalById.get(o.signal_id) : undefined;
    const a = accountById.get(o.account_id);
    const p = stepProgress(o, steps);
    return {
      id: o.id,
      score: o.score,
      lead: isLead(o),
      promoted: o.promoted === true,
      account: a?.name ?? "Unknown account",
      county: a ? `${a.county}, ${a.state}` : "",
      status: a?.customer_status ?? "Prospect",
      rep: repById.get(o.rep_id ?? "")?.name ?? "—",
      signalId: s?.id ?? null,
      signalLabel: s ? `${eventLine(s)} · ${weekLabel(s.week_of)}` : "List prospecting",
      headline: s?.headline ?? "",
      module: o.lead_with,
      amount: o.amount,
      stage: o.stage,
      created: o.created_at,
      createdLabel: dateTime(o.created_at),
      signalDriven: o.is_signal_driven,
      steps: p ? `${p.done}/${p.total} steps` : null,
      amountTip: a ? amountExplain(o.lead_with, a.acres, settings.price_list) : "Module rate per acre × acres + setup.",
      replied: o.response ? RESPONSE_LABEL[o.response] : null,
    };
  });

  // The Signal filter offers every signal present in the rows, newest first,
  // plus whichever signal the URL asked for.
  const inRows = new Set(rows.map((r) => r.signalId).filter(Boolean));
  const optionSignals = signals
    .filter((s) => inRows.has(s.id) || s.id === signalFilter)
    .sort((a, b) => b.week_of.localeCompare(a.week_of) || a.id.localeCompare(b.id));
  const signalOptions: SignalOption[] = optionSignals.map((s) => ({ id: s.id, label: `${eventLine(s)} · ${weekLabel(s.week_of)}` }));

  return (
    <>
      <Header view={view} reps={reps} active="pipeline" />
      <Page>
        {filterSignal && (
          <div className="mb-3">
            <BackLink href={`/signals/${filterSignal.id}`} label={filterSignal.headline} />
          </div>
        )}
        <h1 className="mb-4 text-2xl font-bold">Generated leads</h1>
        <PipelineClient
          rows={rows}
          signalOptions={signalOptions}
          reps={reps.filter((r) => !r.is_manager).map((r) => r.name)}
          manager={view.kind === "manager"}
          initialSignal={filterSignal ? filterSignal.id : null}
          initialQuery={initialQuery}
        />
        <p className="mt-3 text-xs text-[#7a8794]">
          Leads are opportunities scoring 50 or more, plus any a rep promoted. Open pipeline counts Draft, Accepted and Sent in the
          current view. Click Score, Amount or Created to sort.
        </p>
      </Page>
    </>
  );
}
