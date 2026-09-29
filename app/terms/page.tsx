import { BackLink, Card, Page } from "@/components/ui";

export const dynamic = "force-static";

// The ten definitions, verbatim from the pitch deck.
const TERMS: [string, string][] = [
  ["Signal", "One weather event in one county in one week that changes what a grower needs. The unit everything else hangs off."],
  ["D0 – D4", "US Drought Monitor severity, published every Thursday by county. D0 abnormally dry, D1 moderate, D2 severe, D3 extreme, D4 exceptional. A change of level is the signal, not the level itself."],
  ["Severity", "How urgent the signal is: High or Medium. Set by rule (a two-step drought jump, heat over 98 °F for 3+ days, or 3+ inches of rain in 5 days is High)."],
  ["Territory", "The counties a sales rep owns. The dashboard shows only that rep's accounts and signals; the map shades it."],
  ["Account", "A farm, co-op or irrigation district: customer or prospect, with county, crops, acres and the FieldSense modules it already owns."],
  ["Lead with", "The one FieldSense module to open the conversation with, chosen from the signal type and the modules the account does not yet own."],
  ["Score", "0–100 likelihood this account will engage this week, produced by Claude from acreage, crop, module gap and signal severity. Sorts the list; does not set the amount."],
  ["Why now", "One sentence, written per account, that a rep can say on the phone: what happened, why it matters to this farm, this week."],
  ["Amount", "Estimated first-year value: module rate per acre × the account's acres, plus setup. The opportunity's value in the pipeline."],
  ["Stage", "Draft (generated, not yet accepted) → Accepted (the rep took the lead into their pipeline; the outreach sequence runs from here) → Sent (rep sent the email) → Won or Lost."],
];

export default function Terms() {
  return (
    <Page>
      <div className="mx-auto max-w-3xl">
        <BackLink href="/" label="Welcome" />
        <h1 className="mb-1 mt-4 text-2xl font-bold text-[#3a728a]">Terminology</h1>
        <p className="mb-5 text-[#5a6975]">Ten terms you will see on the screens.</p>
        <Card className="overflow-hidden">
          <dl>
            {TERMS.map(([term, meaning], i) => (
              <div key={term} className={`grid gap-1 px-5 py-3 sm:grid-cols-[140px_1fr] sm:gap-4 ${i % 2 ? "bg-[#f6f7f8]" : ""}`}>
                <dt className="font-bold text-[#3a728a]">{term}</dt>
                <dd className="text-[#3f4e5b]">{meaning}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </Page>
  );
}
