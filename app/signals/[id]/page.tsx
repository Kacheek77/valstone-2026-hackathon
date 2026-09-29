import Link from "next/link";
import { notFound } from "next/navigation";
import { GenerateButton } from "@/components/GenerateButton";
import { Header } from "@/components/Header";
import { PromoteButton } from "@/components/PromoteButton";
import { BackLink, Card, EmptyState, ErrorBox, InfoTip, Page, SEVERITY_COLOR, SEVERITY_TINT, StatusBadge } from "@/components/ui";
import { loadAll } from "@/lib/data";
import { usdExact, weekLabel } from "@/lib/format";
import { matchAccounts } from "@/lib/match";
import { amountFor } from "@/lib/pricing";
import { DEFAULT_THRESHOLD, isLead, THRESHOLDS, type Account, type Opportunity, type SignalType } from "@/lib/types";
import { DEMO_REP_ID, getView } from "@/lib/view";

export const dynamic = "force-dynamic";

const SIGNAL_ID = /^SIG-\d{4}$/;

const TYPE_LABEL: Record<SignalType, string> = {
  drought: "Drought worsened",
  rain: "Excess rain",
  heat: "Heat stress",
};

type Row = { account: Account; leadWith: string; opp: Opportunity | null; estimate: number };

function ScoreRing({ score, threshold }: { score: number; threshold: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? "#1f9d55" : score >= threshold ? "#3a728a" : "#bcc4cb";
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" role="img" aria-label={`Score ${score}`}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e3e7eb" strokeWidth="4" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 20 20)"
      />
      <text x="20" y="24.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f1419">
        {score}
      </text>
    </svg>
  );
}

export default async function SignalDetail(props: PageProps<"/signals/[id]">) {
  const { id } = await props.params;
  if (!SIGNAL_ID.test(id)) notFound();
  const sp = await props.searchParams;
  const tParam = Number(typeof sp.t === "string" ? sp.t : NaN);
  // Changing the threshold re-classifies rows; it never re-scores them.
  const threshold = THRESHOLDS.includes(tParam) ? tParam : DEFAULT_THRESHOLD;
  const view = await getView();

  const loaded = await loadAll();
  if (!loaded.ok) {
    return (
      <>
        <Header view={view} reps={null} active={null} />
        <Page>
          <ErrorBox>{loaded.error} This signal will load once the database is reachable.</ErrorBox>
        </Page>
      </>
    );
  }
  const { reps, accounts, signals, opps, settings } = loaded.data;
  const signal = signals.find((s) => s.id === id);
  if (!signal) notFound();

  const matches = matchAccounts(signal, accounts, reps);
  const sOpps = opps.filter((o) => o.signal_id === signal.id);
  const byAccount = new Map(sOpps.map((o) => [o.account_id, o]));

  const rows: Row[] = matches.map((m) => ({
    account: m.account,
    leadWith: byAccount.get(m.account.id)?.lead_with ?? m.leadWith,
    opp: byAccount.get(m.account.id) ?? null,
    estimate: amountFor(m.leadWith, m.account.acres, settings.price_list),
  }));
  // Opportunities whose account no longer matches still belong on the list.
  for (const o of sOpps) {
    if (rows.some((r) => r.account.id === o.account_id)) continue;
    const account = accounts.find((a) => a.id === o.account_id);
    if (account) rows.push({ account, leadWith: o.lead_with, opp: o, estimate: o.amount });
  }
  rows.sort((a, b) => {
    if (a.opp && b.opp) return b.opp.score - a.opp.score;
    if (a.opp) return -1;
    if (b.opp) return 1;
    return b.account.acres - a.account.acres;
  });

  const pending = rows.filter((r) => !r.opp).map((r) => r.account.id);
  const color = SEVERITY_COLOR[signal.severity];
  const backHref = view.kind === "manager" ? `/dashboard?rep=${signal.rep_id ?? DEMO_REP_ID}` : "/dashboard";
  const owner = reps.find((r) => r.id === signal.rep_id);

  return (
    <>
      <Header view={view} reps={reps} active={view.kind === "rep" ? "dashboard" : null} />
      <Page>
        <div className="mb-4">
          <BackLink href={backHref} label={view.kind === "manager" && owner ? `${owner.name}'s dashboard` : "Dashboard"} />
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex-1 rounded-xl border-l-[6px] px-5 py-4" style={{ background: SEVERITY_TINT[signal.severity], borderColor: color }}>
            <p className="text-sm text-[#5a6975]">
              {TYPE_LABEL[signal.type]} · <b style={{ color }}>{signal.severity}</b> · Week of {weekLabel(signal.week_of)}
              {owner ? ` · ${owner.territory_name}` : ""}
            </p>
            <h1 className="mt-1 text-xl font-bold leading-snug">{signal.headline}</h1>
            <p className="mt-2 leading-relaxed text-[#3f4e5b]">{signal.detail}</p>
            <p className="mt-2 text-sm text-[#5a6975]">Source: {signal.source}</p>
          </div>
          <div className="md:pt-2">
            <GenerateButton signalId={signal.id} pendingAccountIds={pending} total={rows.length} leads={sOpps.filter((o) => isLead(o, threshold)).length} />
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-[#3f4e5b]">Affected accounts, ranked</h2>
          <nav className="flex items-center gap-2 text-sm" aria-label="Lead threshold">
            <span className="text-[#5a6975]">Lead threshold</span>
            {THRESHOLDS.map((t) => (
              <Link
                key={t}
                href={t === DEFAULT_THRESHOLD ? `/signals/${signal.id}` : `/signals/${signal.id}?t=${t}`}
                scroll={false}
                className={`rounded-full px-3 py-1 transition-colors duration-150 ${
                  t === threshold ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"
                }`}
              >
                {t}
              </Link>
            ))}
          </nav>
        </div>
        {rows.length === 0 ? (
          <EmptyState>
            No accounts match this signal: none farm a relevant crop in {signal.county}
            {signal.type === "drought" ? " or the rest of the territory" : ""}, or they already own every module.
          </EmptyState>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#efefef] text-[#3f4e5b]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">
                    <span className="flex items-center gap-1.5">
                      Score
                      <InfoTip label="What drives the score">
                        <b>Drivers:</b> signal severity (High 35, Medium 25), acreage (up to 25), module gap (20 when the
                        account lacks the signal&apos;s own module, else 10), crop directly affected (10), existing customer (5)
                        and contact in the last 30 days (5). Claude starts from that total and may move it by up to 10 with a
                        reason.
                        <br />
                        <br />
                        <b>If Claude is offline:</b> High 70 / Medium 55, +15 over 3,000 acres or +8 over 1,500, +10 for a
                        prospect, capped at 100, marked &ldquo;AI offline&rdquo;.
                      </InfoTip>
                    </span>
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Account</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Crops · acres</th>
                  <th className="px-3 py-2.5 font-semibold">Lead with</th>
                  <th className="px-3 py-2.5 font-semibold">Why now</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ account, leadWith, opp, estimate }) => {
                  const below = opp !== null && !isLead(opp, threshold);
                  const underScore = opp !== null && opp.score < threshold;
                  return (
                    <tr key={account.id} className={`border-t border-[#eef0f2] align-top transition-colors duration-150 hover:bg-[#f6f7f8] ${below ? "text-[#9aa5ae]" : ""}`}>
                      <td className="px-4 py-2.5">
                        {opp ? <ScoreRing score={opp.score} threshold={threshold} /> : <span className="inline-block pt-2 text-[#bcc4cb]">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {opp ? (
                          <Link href={`/opportunities/${opp.id}`} className="font-semibold text-[#3a728a] hover:underline">
                            {account.name}
                          </Link>
                        ) : (
                          <span className="font-semibold">{account.name}</span>
                        )}
                        <p className="text-xs text-[#7a8794]">
                          {account.county}, {account.state}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={account.customer_status} />
                      </td>
                      <td className="px-3 py-3">
                        {account.crops.join(", ")} · {account.acres.toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-3">{leadWith}</td>
                      <td className="max-w-sm px-3 py-3">
                        {opp ? (
                          <>
                            {opp.why_now}
                            <span className="mt-1 flex gap-2">
                              {below && <span className="rounded bg-[#eef0f2] px-1.5 py-0.5 text-xs text-[#7a8794]">below threshold</span>}
                              {underScore && <PromoteButton oppId={opp.id} promoted={opp.promoted === true} />}
                              {opp.ai_offline && <span className="rounded bg-[#fcf1d9] px-1.5 py-0.5 text-xs text-[#8a5a00]">AI offline</span>}
                            </span>
                          </>
                        ) : (
                          <span className="italic text-[#9aa5ae]">Not scored yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {opp ? usdExact(opp.amount) : <span className="text-[#9aa5ae]">{usdExact(estimate)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
        <p className="mt-3 text-xs text-[#7a8794]">
          Matching is deterministic: accounts in the county{signal.type === "drought" ? " and the rest of its territory" : ""}, with a
          relevant crop, that do not yet own the module. Claude scores and writes each row; a rules-based score marked
          &ldquo;AI offline&rdquo; stands in if Claude is unavailable. Rows under the threshold ({threshold}) are grayed unless promoted to a lead.
        </p>
      </Page>
    </>
  );
}
