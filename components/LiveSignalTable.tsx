"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { finishSignalAction } from "@/app/actions";
import { SCORE_TIP, usdExact as usd } from "@/lib/format";
import { amountExplain } from "@/lib/pricing";
import type { PriceList } from "@/lib/types";
import type { ScoredOpp } from "@/lib/generate";
import { PromoteButton } from "./PromoteButton";
import { ScoreRing } from "./ScoreRing";
import { runGenerate } from "./runGenerate";
import { Card, HoverTip, InfoTip, StatusBadge } from "./ui";

export type LiveRow = {
  accountId: string;
  name: string;
  place: string;
  status: "Customer" | "Prospect";
  crops: string;
  acres: number;
  leadWith: string;
  estimate: number;
  opp: ScoredOpp | null;
};

type Progress = { done: number; total: number; offline: number; failed: string[]; state: "idle" | "running" | "done" | "partial" };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;


// VS-12 T9 + T11: the signal page scores its unscored matches as soon as it
// opens (three at a time), and each row fills in live: shimmer while waiting,
// score ring sweeps in, why-now fades in, rows re-sort by score (FLIP).
// A Web Lock per signal keeps a second tab from running the same batch; the
// server also skips (and de-duplicates) accounts that already have a lead.
export function LiveSignalTable({
  signalId,
  rows: serverRows,
  threshold,
  filter,
  canPromote,
  county,
  drought,
  prices,
}: {
  signalId: string;
  rows: LiveRow[];
  threshold: number;
  // VS-14 P1: scored rows under this score are hidden (0 = show all).
  filter: number;
  canPromote: boolean;
  county: string;
  drought: boolean;
  prices: PriceList;
}) {
  const router = useRouter();
  const pendingKey = serverRows.filter((r) => !r.opp).map((r) => r.accountId).join(",");
  const [scored, setScored] = useState<Map<string, ScoredOpp>>(() => new Map());
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [elsewhere, setElsewhere] = useState(false);
  const [progress, setProgress] = useState<Progress>(() => {
    const total = pendingKey ? pendingKey.split(",").length : 0;
    return { done: 0, total, offline: 0, failed: [], state: total ? "running" : "idle" };
  });
  const [barHidden, setBarHidden] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !pendingKey) return;
    started.current = true;
    const ids = pendingKey.split(",");
    const run = async () => {
      const summary = await runGenerate(signalId, ids, (s, last) => {
        const r = last.result;
        if (r.ok && r.opp) {
          const opp = r.opp;
          setScored((m) => new Map(m).set(last.accountId, opp));
          setFresh((f) => new Set(f).add(last.accountId));
        }
        setProgress((p) => ({ ...p, done: s.done, offline: s.offline, failed: s.failed }));
      });
      try {
        await finishSignalAction(signalId);
      } catch {
        // Cosmetic status only.
      }
      setProgress((p) => ({ ...p, state: summary.failed.length ? "partial" : "done" }));
      router.refresh();
    };
    if (typeof navigator !== "undefined" && navigator.locks) {
      void navigator.locks.request(`sd-score-${signalId}`, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          setElsewhere(true);
          return;
        }
        await run();
      });
    } else {
      void run();
    }
  }, [pendingKey, signalId, router]);

  // Another tab holds the lock: follow its progress from the database.
  useEffect(() => {
    if (!elsewhere) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [elsewhere, router]);

  // Green, then fade out.
  useEffect(() => {
    if (progress.state !== "done") return;
    const t = setTimeout(() => setBarHidden(true), 1500);
    return () => clearTimeout(t);
  }, [progress.state]);

  const rows = serverRows.map((r) => (r.opp ? r : { ...r, opp: scored.get(r.accountId) ?? null }));
  rows.sort((a, b) => {
    if (a.opp && b.opp) return b.opp.score - a.opp.score;
    if (a.opp) return -1;
    if (b.opp) return 1;
    return b.acres - a.acres;
  });
  const running = progress.state === "running" || (elsewhere && rows.some((r) => !r.opp));
  const doneCount = elsewhere ? rows.filter((r) => r.opp).length - (serverRows.length - progress.total) : progress.done;

  // FLIP: rows slide to their new position when the order changes.
  const orderKey = rows.map((r) => r.accountId).join(",");
  const rowEls = useRef(new Map<string, HTMLTableRowElement>());
  const lastTop = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const animate = !reducedMotion();
    const next = new Map<string, number>();
    rowEls.current.forEach((el, id) => {
      const top = el.offsetTop;
      next.set(id, top);
      const prev = lastTop.current.get(id);
      if (animate && prev !== undefined && prev !== top) {
        el.style.transition = "none";
        el.style.transform = `translateY(${prev - top}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 300ms ease";
          el.style.transform = "";
        });
      }
    });
    lastTop.current = next;
  }, [orderKey]);

  const leads = rows.filter((r) => r.opp && (r.opp.score >= threshold || r.opp.promoted)).length;
  const hiddenIds = new Set(rows.filter((r) => r.opp && r.opp.score < filter).map((r) => r.accountId));
  const shownRows = showHidden ? rows : rows.filter((r) => !hiddenIds.has(r.accountId));

  return (
    <>
      {progress.total > 0 && !barHidden && (
        <div
          className={`mb-4 transition-opacity duration-500 ${progress.state === "done" ? "opacity-90" : ""}`}
          role="status"
          aria-live="polite"
        >
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className={progress.state === "done" ? "font-semibold text-[#1f9d55]" : "text-[#3f4e5b]"}>
              {progress.state === "done"
                ? `Scored ${progress.total} of ${progress.total} · ${leads} lead${leads === 1 ? "" : "s"}`
                : elsewhere
                  ? `Scoring in another tab · ${Math.max(0, doneCount)} of ${progress.total}`
                  : `Claude is scoring · ${progress.done} of ${progress.total}`}
            </span>
            {progress.offline > 0 && <span className="text-xs text-[#5a6975]">AI offline for {progress.offline}: rules-based scores used</span>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e3e7eb]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(Math.max(0, elsewhere ? doneCount : progress.done) / progress.total) * 100}%`,
                background: progress.state === "done" ? "#1f9d55" : progress.state === "partial" ? "#c47d00" : "#3a728a",
              }}
            />
          </div>
          {progress.state === "partial" && (
            <p className="mt-1 text-xs text-[#8f2424]">
              {progress.failed.length} could not be scored ({progress.failed[0]}). Reload the page to retry them.
            </p>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#bcc4cb] px-5 py-6 text-center text-sm text-[#5a6975]">
          No accounts match this signal: none farm a relevant crop in {county}
          {drought ? " or the rest of the territory" : ""}, or they already own every module.
        </p>
      ) : (
        // VS-14 P1: the table grows with the page (no inner scroll on desktop).
        <Card className="overflow-x-auto lg:overflow-visible">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#efefef] text-[#3f4e5b]">
              <tr>
                <th className="px-4 py-2.5 font-semibold">
                  <span className="flex items-center gap-1.5">
                    Score
                    <InfoTip label="What drives the score">
                      <b>Drivers:</b> signal severity (High 35, Medium 25), acreage (up to 25), module gap (20 when the account
                      lacks the signal&apos;s own module, else 10), crop directly affected (10), existing customer (5) and contact in
                      the last 30 days (5). Claude starts from that total and may move it by up to 10 with a reason.
                      <br />
                      <br />
                      <b>If Claude is offline:</b> High 70 / Medium 55, +15 over 3,000 acres or +8 over 1,500, +10 for a prospect,
                      capped at 100, marked &ldquo;AI offline&rdquo;.
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
              {shownRows.map((r) => {
                const opp = r.opp;
                const isNew = fresh.has(r.accountId);
                const below = (opp !== null && !(opp.score >= threshold || opp.promoted)) || hiddenIds.has(r.accountId);
                const underScore = opp !== null && opp.score < threshold;
                const waiting = !opp && running;
                return (
                  <tr
                    key={r.accountId}
                    ref={(el) => {
                      if (el) rowEls.current.set(r.accountId, el);
                      else rowEls.current.delete(r.accountId);
                    }}
                    className={`relative border-t border-[#eef0f2] bg-white align-top transition-colors duration-150 hover:bg-[#f6f7f8] ${below ? "text-[#9aa5ae]" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      {opp ? (
                        <HoverTip tip={SCORE_TIP}>
                          <ScoreRing score={opp.score} threshold={threshold} sweep={isNew} />
                        </HoverTip>
                      ) : waiting ? (
                        <span className="sd-shimmer mt-1 block h-8 w-8 rounded-full" aria-label="Scoring" />
                      ) : (
                        <span className="inline-block pt-2 text-[#bcc4cb]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {opp ? (
                        <Link href={`/opportunities/${opp.id}`} className="font-semibold text-[#3a728a] hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        <span className="font-semibold">{r.name}</span>
                      )}
                      <p className="text-xs text-[#7a8794]">{r.place}</p>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-3">
                      {r.crops} · {r.acres.toLocaleString("en-US")}
                    </td>
                    <td className="px-3 py-3">{opp?.lead_with ?? r.leadWith}</td>
                    <td className="max-w-sm px-3 py-3">
                      {opp ? (
                        <div className={isNew ? "sd-fade-in" : undefined}>
                          {opp.why_now}
                          <span className="mt-1 flex gap-2">
                            {below && <span className="rounded bg-[#eef0f2] px-1.5 py-0.5 text-xs text-[#7a8794]">below threshold</span>}
                            {underScore && canPromote && <PromoteButton oppId={opp.id} promoted={opp.promoted === true} />}
                            {opp.ai_offline && <span className="rounded bg-[#fcf1d9] px-1.5 py-0.5 text-xs text-[#8a5a00]">AI offline</span>}
                          </span>
                        </div>
                      ) : waiting ? (
                        <span className="flex flex-col gap-1.5 pt-1" aria-hidden>
                          <span className="sd-shimmer block h-2.5 w-56" />
                          <span className="sd-shimmer block h-2.5 w-40" />
                        </span>
                      ) : (
                        <span className="italic text-[#9aa5ae]">Not scored yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <HoverTip tip={amountExplain(opp?.lead_with ?? r.leadWith, r.acres, prices)} align="right">
                        {opp ? usd(opp.amount) : <span className="text-[#9aa5ae]">{usd(r.estimate)}</span>}
                      </HoverTip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {hiddenIds.size > 0 && (
        <p className="mt-2 text-sm text-[#5a6975]">
          {hiddenIds.size} account{hiddenIds.size === 1 ? "" : "s"} below {filter} {showHidden ? "shown greyed" : "hidden"} ·{" "}
          <button type="button" onClick={() => setShowHidden((v) => !v)} className="text-[#3a728a] underline underline-offset-2">
            {showHidden ? "Hide" : "Show"}
          </button>
        </p>
      )}
    </>
  );
}
