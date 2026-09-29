import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { BackLink, Card, ErrorBox, Page, StageBadge } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { eventLine, usdExact } from "@/lib/format";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Read-only opportunity view so every link resolves in VS-4. VS-5 replaces
// this with the editable draft and the CRM push.
export default async function OpportunityPage(props: PageProps<"/opportunities/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const view = await getView();

  const loaded = await loadAll();
  if (!loaded.ok) {
    return (
      <>
        <Header view={view} reps={null} active="pipeline" />
        <Page>
          <ErrorBox>{loaded.error} This opportunity will load once the database is reachable.</ErrorBox>
        </Page>
      </>
    );
  }
  const { reps, accounts, signals, opps } = loaded.data;
  const opp = opps.find((o) => o.id === id);
  if (!opp) notFound();
  const account = accounts.find((a) => a.id === opp.account_id);
  const signal = signals.find((s) => s.id === opp.signal_id);

  return (
    <>
      <Header view={view} reps={reps} active="pipeline" />
      <Page>
        <div className="mb-4">
          <BackLink href="/pipeline" label="Pipeline" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <div className="flex flex-col gap-3">
            <Card className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7a8794]">Account</p>
              <p className="mt-1 text-lg font-bold">{account?.name ?? "Unknown account"}</p>
              {account && (
                <p className="text-sm text-[#3f4e5b]">
                  {account.contact_name} · {account.county}, {account.state}
                  <br />
                  {account.crops.join(", ")} · {account.acres.toLocaleString("en-US")} acres
                  <br />
                  Owns: {account.modules_owned.length ? account.modules_owned.join(", ") : "nothing yet (prospect)"}
                </p>
              )}
            </Card>
            {signal && (
              <Card className="px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#7a8794]">Signal</p>
                <Link href={`/signals/${signal.id}`} className="mt-1 block font-semibold text-[#3a728a] hover:underline">
                  {eventLine(signal)}
                </Link>
                <p className="text-sm text-[#3f4e5b]">{signal.headline}</p>
              </Card>
            )}
            <Card className="px-5 py-4">
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-bold text-[#3a728a]">{opp.score}</p>
                <StageBadge stage={opp.stage} />
              </div>
              <p className="text-sm text-[#3f4e5b]">Lead with {opp.lead_with}</p>
              <p className="mt-2 text-xl font-bold">{usdExact(opp.amount)}</p>
              <p className="text-xs text-[#7a8794]">Module rate per acre × acres + $2,500 setup, rounded to $100</p>
              {opp.ai_offline && <p className="mt-2 text-xs text-[#8a5a00]">AI offline: rules-based score and template draft.</p>}
            </Card>
          </div>
          <div className="flex flex-col gap-3">
            <Card className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7a8794]">Why now</p>
              <p className="mt-1 leading-relaxed">{opp.why_now}</p>
            </Card>
            <Card className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7a8794]">Draft email</p>
              <p className="mt-1 font-semibold">{opp.email_subject}</p>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-[#3f4e5b]">{opp.email_body}</p>
            </Card>
            <p className="text-xs text-[#7a8794]">Editing the draft and pushing to the CRM arrive in the next build.</p>
          </div>
        </div>
      </Page>
    </>
  );
}
