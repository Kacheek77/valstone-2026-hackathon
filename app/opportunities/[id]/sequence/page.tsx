import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { SequenceTable, type SequenceRow } from "@/components/SequenceTable";
import { BackLink, EmptyState, ErrorBox, Page } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { usdExact } from "@/lib/format";
import { day0Status, dueDate, formatDue, stepsFor, stepStatus } from "@/lib/steps";
import { SEQUENCE_DAYS } from "@/lib/types";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

const OPP_ID = /^OPP-\d{4}$/;

export default async function SequencePage(props: PageProps<"/opportunities/[id]/sequence">) {
  const { id } = await props.params;
  if (!OPP_ID.test(id)) notFound();
  const view = await getView();
  const loaded = await loadAll();
  if (!loaded.ok) {
    return (
      <>
        <Header view={view} reps={null} active="pipeline" />
        <Page>
          <ErrorBox>{loaded.error} The sequence will load once the database is reachable.</ErrorBox>
        </Page>
      </>
    );
  }
  const { reps, accounts, opps, steps } = loaded.data;
  const opp = opps.find((o) => o.id === id);
  if (!opp) notFound();
  const account = accounts.find((a) => a.id === opp.account_id);
  const closed = opp.stage === "won" || opp.stage === "lost";
  const mine = stepsFor(opp.id, steps);
  const accepted = opp.stage !== "draft";

  const rows: SequenceRow[] = [
    {
      id: null,
      day: 0,
      due: accepted ? formatDue(dueDate(opp, 0)) : "—",
      channel: "email",
      title: opp.email_subject,
      body: opp.email_body,
      status: day0Status(opp),
      aiOffline: opp.ai_offline,
    },
    ...mine.map((s) => ({
      id: s.id,
      day: s.day,
      due: formatDue(dueDate(opp, s.day)),
      channel: s.channel,
      title: s.title,
      body: s.body,
      status: stepStatus(opp, s),
      aiOffline: s.ai_offline,
    })),
  ];

  return (
    <>
      <Header view={view} reps={reps} active="pipeline" />
      <Page>
        <div className="mb-3">
          <BackLink href={`/opportunities/${opp.id}`} label="Opportunity" />
        </div>
        <p className="text-sm text-[#5a6975]">
          {account?.name ?? "Account"} · {opp.lead_with} · {usdExact(opp.amount)}
          {opp.pushed_at ? ` · Accepted ${formatDue(new Date(opp.pushed_at))}` : ""}
          {closed ? ` · Closed (${opp.stage === "won" ? "won" : "lost"})` : ""}
        </p>
        <h1 className="mb-4 mt-1 text-2xl font-bold">
          Outreach sequence · {SEQUENCE_DAYS.length + 1} touches over {SEQUENCE_DAYS[SEQUENCE_DAYS.length - 1]} days
        </h1>

        {!accepted ? (
          <EmptyState>Accept the lead on the opportunity page first; the sequence runs from the day it is accepted.</EmptyState>
        ) : (
          <>
            <SequenceTable oppId={opp.id} rows={rows} built={mine.length > 0} readOnly={closed} />
            {mine.length === 0 && !closed && (
              <p className="mt-3 text-sm text-[#5a6975]">
                Build sequence writes the Day 3 call script, the Day 7 follow-up email and the Day 14 text in one step, in the
                rep&apos;s voice. Day 0 is the opening email above.
              </p>
            )}
          </>
        )}
        <p className="mt-3 text-xs text-[#7a8794]">
          Due dates run from the day the lead was accepted. Day 0 mirrors the opportunity: Sent ✓ once it is marked sent.
          Schedule all puts the steps on the dashboard&apos;s My tasks list. Rebuild rewrites every step not yet done. Click a step to
          read or edit it.
        </p>
      </Page>
    </>
  );
}
