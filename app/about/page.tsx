import { ResetDemoButton } from "@/components/ResetDemoButton";
import { BackLink, Card, Page } from "@/components/ui";

// Dynamic only to read ?admin=1; there are no data calls on this page.
export const dynamic = "force-dynamic";

// [draft] copy: pending her voice pass.
const REAL = [
  "Claude scores every matched account and writes the why-now line and the email when you click Generate leads. If Claude is unreachable, a rules-based score and a template stand in, marked “AI offline”.",
  "Matching is real logic: accounts in the affected county (for drought, the whole territory), with a relevant crop, that do not yet own the module.",
  "Refresh signals calls the US Drought Monitor’s county data service live and adds a signal only when a county’s drought category has risen.",
  "Amounts come from one formula: module rate per acre × acres + $2,500 setup, rounded to $100.",
  "Tone pills and “Tell Claude what to change” rewrite a draft live, in the rep’s own voice note; every earlier version is kept so the original can be restored.",
];

const SEEDED = [
  "All 50 accounts, their contacts and the six reps are synthetic, placed in real Plains counties. A real deployment would read the Salesforce account base.",
  "The 23 signals across five weeks (8 this week) are seeded from a generated batch and checked against the real late-September drought picture.",
  "The 42 existing opportunities, their stages and push times are seeded history; the sparklines and time-to-act figures are computed from them.",
  "Push to CRM writes an Opportunity and a follow-up Task to a Salesforce Developer Edition org when one is connected. Without a connection, or if Salesforce does not answer within 8 seconds, the push is queued for CRM sync and the opportunity still moves to Pushed.",
];

export default async function About(props: PageProps<"/about">) {
  const sp = await props.searchParams;
  const admin = sp.admin === "1";
  return (
    <Page>
      <div className="mx-auto max-w-3xl">
        <BackLink href="/" label="Welcome" />
        <h1 className="mb-1 mt-4 text-2xl font-bold text-[#3a728a]">What is real vs. seeded</h1>
        <p className="mb-5 text-[#5a6975]">An honest map of what runs live and what stands in for the hackathon.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-t-[5px] border-t-[#1f9d55] px-5 py-4">
            <h2 className="mb-2 font-bold text-[#1f9d55]">Real</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#3f4e5b]">
              {REAL.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </Card>
          <Card className="border-t-[5px] border-t-[#e89b16] px-5 py-4">
            <h2 className="mb-2 font-bold text-[#c47d00]">Seeded or stand-in</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#3f4e5b]">
              {SEEDED.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </Card>
        </div>
        <Card className="mt-4 px-5 py-4 text-sm text-[#3f4e5b]">
          <b>Demo flag.</b> Live drought data changes slowly, so a refresh often finds nothing new. Open the dashboard with{" "}
          <code className="rounded bg-[#eef0f2] px-1">?demo=1</code> and Refresh signals adds one canned signal (Seward County, KS,
          D3 → D4) so the full flow can be shown on any day.
        </Card>
        {admin && (
          <Card className="mt-4 flex flex-col gap-2 border-[#d23b3b] px-5 py-4 text-sm text-[#3f4e5b]">
            <b>Admin: reset the demo.</b>
            <p>Deletes every opportunity on the Finney signal (SIG-0023) and sets it back to new, so Generate leads can run live again.</p>
            <ResetDemoButton />
          </Card>
        )}
      </div>
    </Page>
  );
}
