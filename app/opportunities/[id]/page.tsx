import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftEditor } from "@/components/DraftEditor";
import { Header } from "@/components/Header";
import { OppActions, ReopenLink } from "@/components/OppActions";
import { BackLink, Card, ErrorBox, Page, StageBadge } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { dateTime, eventLine, usdExact } from "@/lib/format";
import { stepProgress } from "@/lib/steps";
import { isLead } from "@/lib/types";
import { getView } from "@/lib/view";

export const dynamic = "force-dynamic";

const OPP_ID = /^OPP-\d{4}$/;
const SIGNAL_ID = /^SIG-\d{4}$/;

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-[#7a8794]">{children}</p>;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
}

export default async function OpportunityPage(props: PageProps<"/opportunities/[id]">) {
  const { id } = await props.params;
  if (!OPP_ID.test(id)) notFound();
  const sp = await props.searchParams;
  // Tweak 4: "← Pipeline" keeps the signal filter only when the user came from a filtered list.
  const fromSignal = typeof sp.from === "string" && SIGNAL_ID.test(sp.from) ? sp.from : null;
  const fromTeam = typeof sp.from === "string" && /^REP-\d{2}$/.test(sp.from) ? sp.from : null;
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
  const { reps, accounts, signals, opps, steps } = loaded.data;
  const opp = opps.find((o) => o.id === id);
  if (!opp) notFound();
  const account = accounts.find((a) => a.id === opp.account_id);
  const signal = signals.find((s) => s.id === opp.signal_id);
  const rep = reps.find((r) => r.id === opp.rep_id);
  const closed = opp.stage === "won" || opp.stage === "lost";
  // VS-9: a manager drilling in sees the opportunity read-only (Copy email only).
  const managerView = view.kind === "manager";
  const readOnly = closed || managerView;
  const progress = stepProgress(opp, steps);
  // Closing date: the most recent timestamp we have for the opportunity.
  const closedOn = opp.sent_at ?? opp.pushed_at ?? opp.created_at;

  return (
    <>
      <Header view={view} reps={reps} active="pipeline" />
      <Page>
        <div className="mb-4">
          {fromTeam ? (
            <BackLink href={`/team/${fromTeam}`} label={`${rep?.name ?? "Rep"} summary`} />
          ) : (
            <BackLink href={fromSignal ? `/pipeline?signal=${fromSignal}` : "/pipeline"} label="Pipeline" />
          )}
        </div>
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <Card className="px-5 py-4">
              <Label>Account</Label>
              <p className="mt-1 text-lg font-bold">{account?.name ?? "Unknown account"}</p>
              {account && (
                <div className="text-sm text-[#3f4e5b]">
                  <p className="truncate" title={[account.contact_name, account.contact_role, account.contact_email].filter(Boolean).join(" · ")}>
                    {account.contact_name}
                    {account.contact_role ? <span className="text-[#7a8794]"> · {account.contact_role}</span> : null}
                  </p>
                  {account.contact_email && (
                    <p className="truncate text-[#5a6975]" title={account.contact_email}>
                      {account.contact_email}
                    </p>
                  )}
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
                  {account.notes && <p className="mt-2 text-[#7a8794]">Rep&apos;s note: {account.notes}</p>}
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
            {managerView && !closed && (
              <div className="rounded-xl bg-[#eef0f2] px-5 py-3 text-sm text-[#3f4e5b]">
                Manager view: read-only. {rep?.name ?? "The rep"} works this opportunity from their own view.
              </div>
            )}
            {closed && (
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-5 py-3 font-semibold ${
                  opp.stage === "won" ? "bg-[#e6f4ec] text-[#14693a]" : "bg-[#eef0f2] text-[#3f4e5b]"
                }`}
              >
                <span>
                  Closed · {opp.stage === "won" ? "Won" : "Lost"} on {shortDate(closedOn)}
                </span>
                {!managerView && <ReopenLink oppId={opp.id} />}
              </div>
            )}
            <Card className="px-5 py-4">
              <Label>Why now</Label>
              <p className="mt-1 leading-relaxed">{opp.why_now}</p>
            </Card>
            <Card className="px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <Label>{readOnly ? "Email" : "Draft email"}</Label>
                {!readOnly && rep?.voice_note && (
                  <p className="text-xs text-[#7a8794]" title={rep.voice_note}>
                    Written in {rep.name.split(" ")[0]}&apos;s voice
                  </p>
                )}
              </div>
              <DraftEditor
                // Keyed on the id (and open/closed) only: the editor already holds the
                // rewritten text, and remounting on every refresh would wipe its status line.
                key={`${opp.id}-${readOnly ? "ro" : "rw"}`}
                oppId={opp.id}
                subject={opp.email_subject}
                body={opp.email_body}
                historyLength={opp.email_history?.length ?? 0}
                readOnly={readOnly}
              />
            </Card>
            {readOnly ? (
              <Card className="px-5 py-4 text-sm text-[#5a6975]">
                <Link href={`/opportunities/${opp.id}/sequence`} className="font-semibold text-[#3a728a] hover:underline">
                  View outreach sequence →
                </Link>
                {progress && <span className="ml-2">{progress.done}/{progress.total} steps done</span>}
              </Card>
            ) : (
              <Card className="flex flex-col gap-3 px-5 py-4">
                <OppActions oppId={opp.id} stage={opp.stage} />
                <div className="text-sm text-[#5a6975]">
                  {opp.stage === "draft" ? (
                    "Accept the lead to move it into your pipeline and start the outreach sequence."
                  ) : (
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold text-[#1f9d55]">✓ Accepted into your pipeline</span>
                      {opp.pushed_at && <span className="text-xs text-[#7a8794]">{dateTime(opp.pushed_at)}</span>}
                      {progress && (
                        <span className="text-xs text-[#7a8794]">
                          · sequence {progress.done}/{progress.total} steps
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </Page>
    </>
  );
}
