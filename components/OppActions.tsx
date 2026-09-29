"use client";

import { useTransition } from "react";
import { pushToCrmAction, setStageAction } from "@/app/actions";
import type { Stage } from "@/lib/types";
import { useToast } from "./Toast";

const primary =
  "rounded-full bg-[#f55a00] px-5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d94f00] disabled:cursor-wait disabled:opacity-60";
const outline =
  "rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-opacity duration-150 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40";

// Stage buttons for one opportunity. Push has two outcomes (in Salesforce, or
// queued for CRM sync); both move the opportunity to Pushed.
export function OppActions({ oppId, stage, sfUrl }: { oppId: string; stage: Stage; sfUrl: string | null }) {
  const [busy, startTransition] = useTransition();
  const [toast, show] = useToast();

  const push = () =>
    startTransition(async () => {
      try {
        const r = await pushToCrmAction(oppId);
        if (!r.ok) show("error", r.error);
        else if (r.outcome === "salesforce")
          show("success", <>Created in Salesforce: Opportunity and follow-up Task. <a href={r.url} target="_blank" rel="noreferrer" className="underline">Open</a></>);
        else show("neutral", `Queued for CRM sync. ${r.reason}`);
      } catch {
        show("error", "The push did not reach the server. Nothing changed.");
      }
    });

  const setStage = (next: "sent" | "won" | "lost") =>
    startTransition(async () => {
      const r = await setStageAction(oppId, next);
      if (!r.ok) show("error", r.error ?? "Could not update the stage.");
      else show("success", next === "sent" ? "Marked as sent." : next === "won" ? "Marked won." : "Marked lost.");
    });

  return (
    <div className="flex flex-wrap items-center gap-3">
      {stage === "draft" ? (
        <button type="button" onClick={push} disabled={busy} className={primary}>
          {busy ? "Pushing…" : "Push to CRM"}
        </button>
      ) : sfUrl ? (
        <a href={sfUrl} target="_blank" rel="noreferrer" className={`${outline} border-[#1f9d55] text-[#1f9d55]`}>
          Open in Salesforce ↗
        </a>
      ) : (
        <button
          type="button"
          onClick={push}
          disabled={busy}
          title="Not in Salesforce yet. Click to retry the sync."
          className={`${outline} border-[#7a8794] text-[#5a6975]`}
        >
          {busy ? "Retrying…" : "Queued for CRM sync ↻"}
        </button>
      )}

      {(stage === "draft" || stage === "pushed") && (
        <button
          type="button"
          onClick={() => setStage("sent")}
          disabled={busy || stage === "draft"}
          title={stage === "draft" ? "Push to CRM first" : undefined}
          className={`${outline} border-[#2a6fb5] text-[#2a6fb5]`}
        >
          Mark sent
        </button>
      )}

      {stage === "sent" && (
        <>
          <button type="button" onClick={() => setStage("won")} disabled={busy} className={`${outline} border-[#1f9d55] text-[#1f9d55]`}>
            Mark won
          </button>
          <button type="button" onClick={() => setStage("lost")} disabled={busy} className={`${outline} border-[#7a8794] text-[#5a6975]`}>
            Mark lost
          </button>
        </>
      )}
      {toast}
    </div>
  );
}
