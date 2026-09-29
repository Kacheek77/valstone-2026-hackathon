import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { BackLink, Card, ErrorBox, Page } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { eventLine, usdExact } from "@/lib/format";
import { isDemoId } from "@/lib/salesforce";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

const OPP_ID = /^OPP-\d{4}$/;

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#eef0f2] py-2">
      <p className="text-xs text-[#7a8794]">{label}</p>
      <div className="text-sm text-[#0f1419]">{children}</div>
    </div>
  );
}

// A plain mock of the Salesforce records a demo-mode push "created". Only
// opportunities pushed in demo mode have one; anything else is a 404.
export default async function CrmRecord(props: PageProps<"/crm/[id]">) {
  const { id } = await props.params;
  if (!OPP_ID.test(id)) notFound();
  const view = await getView();
  const loaded = await loadAll();
  if (!loaded.ok) {
    return (
      <>
        <Header view={view} reps={null} active="pipeline" />
        <Page>
          <ErrorBox>{loaded.error} The record will load once the database is reachable.</ErrorBox>
        </Page>
      </>
    );
  }
  const { reps, accounts, signals, opps } = loaded.data;
  const opp = opps.find((o) => o.id === id);
  if (!opp || !isDemoId(opp.sf_opportunity_id)) notFound();
  const account = accounts.find((a) => a.id === opp.account_id);
  const signal = signals.find((s) => s.id === opp.signal_id);
  const rep = reps.find((r) => r.id === opp.rep_id);
  const pushed = opp.pushed_at ?? opp.created_at;
  const name = `${account?.name ?? "Account"} — ${opp.lead_with} — ${signal ? eventLine(signal) : "list prospecting"}`;
  const sfId = opp.sf_opportunity_id!.slice(5);

  return (
    <>
      <Header view={view} reps={reps} active="pipeline" />
      <Page>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <BackLink href={`/opportunities/${opp.id}`} label="Back to Signal Desk" />
          <span className="rounded-full bg-[#fcf1d9] px-3 py-1 text-xs font-medium text-[#8a5a00]">
            Demo record · no Salesforce org connected
          </span>
        </div>

        <Card className="mb-4 overflow-hidden">
          <div className="border-b border-[#e3e7eb] bg-[#f3f6f9] px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-[#5a6975]">Opportunity</p>
            <h1 className="mt-0.5 text-xl font-bold text-[#0f1419]">{name}</h1>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div><p className="text-xs text-[#7a8794]">Account name</p><p className="font-medium text-[#1b5f9e]">{account?.name}</p></div>
              <div><p className="text-xs text-[#7a8794]">Close date</p><p>{addDays(pushed, 45)}</p></div>
              <div><p className="text-xs text-[#7a8794]">Amount</p><p>{usdExact(opp.amount)}</p></div>
              <div><p className="text-xs text-[#7a8794]">Opportunity owner</p><p>{rep?.name ?? "—"}</p></div>
            </div>
          </div>
          <div className="grid gap-x-8 px-5 py-3 md:grid-cols-2">
            <div>
              <Field label="Opportunity ID">{sfId}</Field>
              <Field label="Stage">Prospecting</Field>
              <Field label="Amount">{usdExact(opp.amount)}</Field>
              <Field label="Close Date">{addDays(pushed, 45)}</Field>
            </div>
            <div>
              <Field label="Lead Source">Signal Desk ({signal ? "weather signal" : "list prospecting"})</Field>
              <Field label="Probability (Signal Desk score)">{opp.score}%</Field>
              <Field label="Primary module">{opp.lead_with}</Field>
              <Field label="Created">{addDays(pushed, 0)}</Field>
            </div>
          </div>
          <div className="px-5 pb-5">
            <Field label="Description">
              <p className="mt-1 whitespace-pre-line leading-relaxed">
                {opp.why_now}
                {"\n\n"}Subject: {opp.email_subject}
                {"\n\n"}
                {opp.email_body}
              </p>
            </Field>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[#e3e7eb] bg-[#f3f6f9] px-5 py-3">
            <p className="text-sm font-semibold">Open Activities (1)</p>
          </div>
          <div className="grid gap-4 px-5 py-3 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-[#7a8794]">Subject</p><p className="font-medium text-[#1b5f9e]">Send Signal Desk email</p></div>
            <div><p className="text-xs text-[#7a8794]">Type</p><p>Task</p></div>
            <div><p className="text-xs text-[#7a8794]">Due date</p><p>{addDays(pushed, 1)}</p></div>
            <div><p className="text-xs text-[#7a8794]">Assigned to</p><p>{rep?.name ?? "—"}</p></div>
          </div>
        </Card>
        <p className="mt-3 text-xs text-[#7a8794]">
          This is what Push to CRM writes to Salesforce: an Opportunity (stage Prospecting, close date 45 days out, the why-now
          line and email as the description) and a follow-up Task due the next day. With a Salesforce org connected, the same
          push creates the real records.
        </p>
      </Page>
    </>
  );
}
