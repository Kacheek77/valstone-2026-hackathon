import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftEditor } from "@/components/DraftEditor";
import { Header } from "@/components/Header";
import { OppActions } from "@/components/OppActions";
import { BackLink, Card, ErrorBox, Page, StageBadge } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { dateTime, eventLine, usdExact } from "@/lib/format";
import { recordUrl } from "@/lib/salesforce";
import { isLead } from "@/lib/types";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

const OPP_ID = /^OPP-\d{4}$/;

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-[#7a8794]">{children}</p>;
}

export default async function OpportunityPage(props: PageProps<"/opportunities/[id]">) {
  const { id } = await props.params;
  if (!OPP_ID.test(id)) notFound();
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
  const rep = reps.find((r) => r.id === opp.rep_id);
  const sfUrl = opp.sf_opportunity_id ? recordUrl(opp.sf_opportunity_id) : null;

  const crmLine =
    opp.stage === "draft"
      ? "Not in the CRM yet. Push creates the Opportunity and a follow-up Task."
      : opp.sf_opportunity_id
        ? `In Salesforce as ${opp.sf_opportunity_id}${opp.pushed_at ? `, pushed ${dateTime(opp.pushed_at)}` : ""}.`
        : `Queued for CRM sync${opp.pushed_at ? ` since ${dateTime(opp.pushed_at)}` : ""}${opp.sf_error ? `: ${opp.sf_error}` : "."}`;

  return (
    <>
      <Header view={view} reps={reps} active="pipeline" />
      <Page>
        <div className="mb-4">
          <BackLink href={signal ? `/pipeline?signal=${signal.id}` : "/pipeline"} label="Pipeline" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <Card className="px-5 py-4">
              <Label>Account</Label>
              <p className="mt-1 text-lg font-bold">{account?.name ?? "Unknown account"}</p>
              {account && (
                <div className="text-sm text-[#3f4e5b]">
                  <p
                    className="truncate"
                    title={[account.contact_name, account.contact_email].filter(Boolean).join(" · ")}
                  >
                    {account.contact_name}
                    {account.contact_email ? ` · ${account.contact_email}` : ""}
                  </p>
                  <p>
                    {account.county}, {account.state} ·{" "}
                    <span className={account.customer_status === "Customer" ? "text-[#1f9d55]" : "text-[#c47d00]"}>
                      {account.customer_status}
                    </span>
                  </p>
                  <p>
                    {account.crops.join(", ")} · {account.acres.toLocaleString("en-US")} acres
                  </p>
                  <p className="mt-2 rounded-lg bg-[#f6f7f8] px-3 py-2">
                    <span className="font-semibold">Owns:</span>{" "}
                    {account.modules_owned.length ? account.modules_owned.join(", ") : "no FieldSense modules yet"}
                  </p>
                </div>
              )}
            </Card>
            <Card className="px-5 py-4">
              <Label>Signal</Label>
              {signal ? (
                <>
                  <Link href={`/signals/${signal.id}`} className="mt-1 block font-semibold text-[#3a728a] hover:underline">
                    {eventLine(signal)}
                  </Link>
                  <p className="text-sm text-[#3f4e5b]">{signal.headline}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-[#3f4e5b]">None: list-prospected, not signal-driven.</p>
              )}
            </Card>
            <Card className="px-5 py-4">
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-bold text-[#3a728a]">{opp.score}</p>
                <StageBadge stage={opp.stage} />
              </div>
              <p className="text-sm text-[#3f4e5b]">
                Lead with {opp.lead_with}
                {!isLead(opp) && <span className="ml-1 text-[#7a8794]">· below threshold</span>}
              </p>
              <p className="mt-2 text-xl font-bold">{usdExact(opp.amount)}</p>
              <p className="text-xs text-[#7a8794]">Module rate per acre × acres + $2,500 setup, rounded to $100</p>
              {opp.ai_offline && <p className="mt-2 text-xs text-[#8a5a00]">AI offline: rules-based score and template draft.</p>}
              {opp.is_off_territory && (
                <p className="mt-2 text-xs text-[#8a5a00]">Off-territory: the account sits outside the rep&apos;s counties.</p>
              )}
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <Card className="px-5 py-4">
              <Label>Why now</Label>
              <p className="mt-1 leading-relaxed">{opp.why_now}</p>
            </Card>
            <Card className="px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <Label>Draft email</Label>
                {rep?.voice_note && (
                  <p className="text-xs text-[#7a8794]" title={rep.voice_note}>
                    Written in {rep.name.split(" ")[0]}&apos;s voice
                  </p>
                )}
              </div>
              <DraftEditor
                // Keyed on the id only: the editor already holds the rewritten text, and
                // remounting on every refresh would wipe its status line.
                key={opp.id}
                oppId={opp.id}
                subject={opp.email_subject}
                body={opp.email_body}
                historyLength={opp.email_history?.length ?? 0}
              />
            </Card>
            <Card className="flex flex-col gap-3 px-5 py-4">
              <OppActions oppId={opp.id} stage={opp.stage} sfUrl={sfUrl} />
              <p className="text-sm text-[#5a6975]">CRM: {crmLine}</p>
            </Card>
          </div>
        </div>
      </Page>
    </>
  );
}
