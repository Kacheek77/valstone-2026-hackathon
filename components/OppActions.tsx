"use client";

import Link from "next/link";
import { useTransition } from "react";
import { acceptLeadAction, setStageAction } from "@/app/actions";
import type { Stage } from "@/lib/types";
import { useToast } from "./Toast";
import { useHydrated } from "@/lib/useHydrated";

const primary =
  "rounded-full bg-[#f55a00] px-5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d94f00] disabled:cursor-wait disabled:opacity-60";
const outline =
  "rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-opacity duration-150 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40";

// Stage buttons for an open opportunity: Draft → Accept lead → Mark sent →
// Mark won / lost. Closed opportunities show a banner instead (see the page).
export function OppActions({ oppId, stage }: { oppId: string; stage: Stage }) {
  const [busy, startTransition] = useTransition();
  const hydrated = useHydrated();
  const [toast, show] = useToast();

  const accept = () =>
    startTransition(async () => {
      try {
        const r = await acceptLeadAction(oppId);
        if (!r.ok) show("error", r.error ?? "Could not accept the lead.");
        else show("success", "Accepted into your pipeline. Build the outreach sequence next.");
      } catch {
        show("error", "The server did not answer. Nothing changed.");
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
        <button type="button" onClick={accept} disabled={!hydrated || busy} className={primary}>
          {busy ? "Accepting…" : "Accept lead"}
        </button>
      ) : (
        <Link href={`/opportunities/${oppId}/sequence`} className={`${outline} border-[#3a728a] text-[#3a728a]`}>
          Open sequence →
        </Link>
      )}

      {(stage === "draft" || stage === "pushed") && (
        <button
          type="button"
          onClick={() => setStage("sent")}
          disabled={!hydrated || busy || stage === "draft"}
          title={stage === "draft" ? "Accept the lead first" : undefined}
          className={`${outline} border-[#2a6fb5] text-[#2a6fb5]`}
        >
          Mark sent
        </button>
      )}

      {stage === "sent" && (
        <>
          <button type="button" onClick={() => setStage("won")} disabled={!hydrated || busy} className={`${outline} border-[#1f9d55] text-[#1f9d55]`}>
            Mark won
          </button>
          <button type="button" onClick={() => setStage("lost")} disabled={!hydrated || busy} className={`${outline} border-[#7a8794] text-[#5a6975]`}>
            Mark lost
          </button>
        </>
      )}
      {toast}
    </div>
  );
}

// Tweak 6: Reopen a closed opportunity (back to Sent) for corrections.
export function ReopenLink({ oppId }: { oppId: string }) {
  const [busy, startTransition] = useTransition();
  const hydrated = useHydrated();
  return (
    <button
      type="button"
      disabled={!hydrated || busy}
      onClick={() => startTransition(async () => void (await setStageAction(oppId, "sent")))}
      className="text-sm underline underline-offset-2 opacity-80 hover:opacity-100 disabled:opacity-50"
    >
      {busy ? "Reopening…" : "Reopen"}
    </button>
  );
}
