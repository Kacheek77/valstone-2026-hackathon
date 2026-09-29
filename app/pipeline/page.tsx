import Link from "next/link";
import { Header } from "@/components/Header";
import { Card, EmptyState, ErrorBox, Page, StageBadge } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { eventLine, usdExact, weekLabel } from "@/lib/format";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

// Minimal pipeline list so every link resolves in VS-4. VS-5 replaces this
// with stage pills and totals.
export default async function Pipeline(props: PageProps<"/pipeline">) {
  const sp = await props.searchParams;
  const signalFilter = typeof sp.signal === "string" ? sp.signal : null;
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

  const visible = opps
    .filter((o) => view.kind === "manager" || o.rep_id === view.repId)
    .filter((o) => !signalFilter || o.signal_id === signalFilter)
    .sort((a, b) => b.score - a.score);

  return (
    <>
      <Header view={view} reps={reps} active="pipeline" />
      <Page>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Pipeline</h1>
          {signalFilter && (
            <Link
              href="/pipeline"
              className="rounded-full bg-[#e3eef4] px-3 py-1 text-sm text-[#3a728a] transition-colors duration-150 hover:bg-[#cee5f3]"
            >
              {filterSignal ? eventLine(filterSignal) : "One signal"} · clear ×
            </Link>
          )}
        </div>
        {visible.length === 0 ? (
          <EmptyState>
            No opportunities yet. Open a signal from the dashboard and click Generate leads.
          </EmptyState>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#efefef] text-left text-[#3f4e5b]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Score</th>
                  <th className="px-3 py-2.5 font-semibold">Account</th>
                  {view.kind === "manager" && <th className="px-3 py-2.5 font-semibold">Rep</th>}
                  <th className="px-3 py-2.5 font-semibold">Signal</th>
                  <th className="px-3 py-2.5 font-semibold">Module</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 font-semibold">Stage</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => {
                  const s = signalById.get(o.signal_id);
                  return (
                    <tr key={o.id} className="relative border-t border-[#eef0f2] transition-colors duration-150 hover:bg-[#f6f7f8]">
                      <td className="px-4 py-3 font-bold text-[#3a728a] tabular-nums">{o.score}</td>
                      <td className="px-3 py-3">
                        <Link href={`/opportunities/${o.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">
                          {accountById.get(o.account_id)?.name ?? "Unknown account"}
                        </Link>
                      </td>
                      {view.kind === "manager" && <td className="px-3 py-3">{repById.get(o.rep_id ?? 0)?.name ?? "—"}</td>}
                      <td className="px-3 py-3">{s ? `${eventLine(s)} · ${weekLabel(s.week_of)}` : "—"}</td>
                      <td className="px-3 py-3">{o.lead_with}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{usdExact(o.amount)}</td>
                      <td className="px-4 py-3"><StageBadge stage={o.stage} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </Page>
    </>
  );
}
