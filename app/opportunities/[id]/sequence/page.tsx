import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { ResponsePanel } from "@/components/ResponsePanel";
import { SequenceTable, type SequenceRow } from "@/components/SequenceTable";
import { BackLink, EmptyState, ErrorBox, InfoTip, Page } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { usdExact } from "@/lib/format";
import { day0Status, dueDate, formatDue, isOpenStep, stepDue, stepsFor, stepStatus } from "@/lib/steps";
import { RESPONSE_LABEL, SEQUENCE_DAYS } from "@/lib/types";
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
  if (view.kind === "rep" && opp.rep_id !== view.repId) redirect(`/dashboard?rep=${view.repId}&note=territory`);
  const rep = reps.find((r) => r.id === opp.rep_id);
  const manager = view.kind === "manager";
  const repName = rep?.name ?? "The rep";
  const account = accounts.find((a) => a.id === opp.account_id);
  const closed = opp.stage === "won" || opp.stage === "lost";
  const readOnly = closed || view.kind === "manager";
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
      due: formatDue(stepDue(opp, s)),
      channel: s.channel,
      title: s.title,
      body: s.body,
      status: stepStatus(opp, s),
      aiOffline: s.ai_offline,
    })),
  ];

  // VS-12 T6: the sequence starts in the tone last used on the email.
  const lastTone = [...(opp.email_history ?? [])].reverse().find((h) => h.note && ["Direct", "Warm", "Technical", "Shorter"].includes(h.note))?.note ?? null;
  // VS-12 T7: an unfinished step (or an unsent Day 0) is past its date.
  const overdue = rows.some((r) => r.status === "Overdue");
  // VS-12 T8: responses need vs12.sql; the columns are absent until it runs.
  const replyEnabled = "response" in opp;
  const complete = mine.length > 0 && day0Status(opp) === "Sent ✓" && !mine.some(isOpenStep) && !opp.response;

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
          Outreach sequence · {SEQUENCE_DAYS.length + 1} touches over {SEQUENCE_DAYS[SEQUENCE_DAYS.length - 1]} days{" "}
          <span className="align-middle text-base font-normal">
            <InfoTip label="How this works">
              Due dates run from the day the lead was accepted; Day 0 is the opening email.
              {readOnly ? "" : " Schedule all puts the steps on My tasks; a tone or Rebuild rewrites every step not yet done."}
            </InfoTip>
          </span>
        </h1>

        {/* VS-13 M1: the manager gets one read-only line, never rep instructions. */}
        {manager && (
          <div className="mb-3 rounded-xl bg-[#eef0f2] px-5 py-3 text-sm text-[#3f4e5b]">
            Read-only in manager view ·{" "}
            {!accepted
              ? `No sequence yet: ${repName} has not accepted this lead.`
              : mine.length === 0
                ? `No sequence yet: ${repName} has not built it.`
                : closed
                  ? `${repName} closed this lead.`
                  : `${repName} works this lead`}
          </div>
        )}
        {!accepted ? (
          !manager && <EmptyState>Accept the lead on the opportunity page first; the sequence runs from the day it is accepted.</EmptyState>
        ) : manager && mine.length === 0 ? null : (
          <>
            {(opp.response || (complete && !readOnly)) && (
              <div className="mb-3">
                <ResponsePanel
                  oppId={opp.id}
                  response={opp.response ?? null}
                  respondedAt={opp.responded_at ?? null}
                  note={opp.response_note ?? null}
                  stage={opp.stage}
                  readOnly={readOnly}
                  complete={complete}
                  enabled={replyEnabled}
                />
              </div>
            )}
            <SequenceTable
              oppId={opp.id}
              rows={rows}
              built={mine.length > 0}
              readOnly={readOnly}
              defaultTone={lastTone}
              overdue={overdue}
              reply={{
                enabled: replyEnabled,
                logged: Boolean(opp.response),
                stage: opp.stage,
                at:
                  opp.response && opp.responded_at
                    ? {
                        day: Math.max(0, Math.round((Date.parse(opp.responded_at) - Date.parse(opp.pushed_at ?? opp.created_at)) / 86_400_000)),
                        label: RESPONSE_LABEL[opp.response],
                      }
                    : null,
              }}
            />
            {mine.length === 0 && !readOnly && (
              <p className="mt-3 text-sm text-[#5a6975]">
                Build sequence writes the Day 3 call script, the Day 7 follow-up email and the Day 14 text in one step, in the
                rep&apos;s voice. Day 0 is the opening email above.
              </p>
            )}
          </>
        )}
      </Page>
    </>
  );
}
