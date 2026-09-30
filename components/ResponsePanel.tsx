"use client";

import { useState, useTransition } from "react";
import { bookFollowUpAction, logResponseAction, setStageAction } from "@/app/actions";
import { useHydrated } from "@/lib/useHydrated";
import { RESPONSE_LABEL, type Response } from "@/lib/types";
import { useToast } from "./Toast";

const CHOICES: Response[] = ["interested", "not_now", "not_interested"];

const pill =
  "rounded-full border px-3 py-1 text-sm transition-colors duration-150 disabled:opacity-50";

// VS-12 T8: close the loop. The rep logs the customer's reply (no new stage),
// and the panel offers the next step for that reply.
export function ResponsePanel({
  oppId,
  response,
  respondedAt,
  note,
  stage,
  complete,
  enabled,
  compact = false,
  readOnly = false,
}: {
  oppId: string;
  response: Response | null;
  respondedAt: string | null;
  note: string | null;
  stage: string;
  // Every step done (Day 0 sent included) and no reply logged.
  complete: boolean;
  // False until supabase/migrations/vs12.sql adds the response columns.
  enabled: boolean;
  // Inline under a done step: just the "Customer replied?" control.
  compact?: boolean;
  // Manager view: show a logged reply, offer nothing.
  readOnly?: boolean;
}) {
  const hydrated = useHydrated();
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState(!compact);
  const [choice, setChoice] = useState<Response | null>(null);
  const [text, setText] = useState("");
  const [toast, show] = useToast();
  const closed = stage === "won" || stage === "lost" || readOnly;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    startTransition(async () => {
      try {
        const r = await fn();
        if (!r.ok) show("error", r.error ?? "Nothing changed.");
        else show("success", done);
      } catch {
        show("error", "The server did not answer. Nothing changed.");
      }
    });

  if (!enabled) {
    return compact ? null : (
      <p className="text-xs text-[#7a8794]">Logging the customer&apos;s reply turns on once supabase/migrations/vs12.sql has run.</p>
    );
  }
  if (closed && !response) return null;

  const when = respondedAt
    ? new Date(respondedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })
    : "";

  // A reply is logged: show it and the next step it calls for.
  if (response) {
    if (compact) return null;
    const tone =
      response === "interested" ? "bg-[#e6f4ec] text-[#14693a]" : response === "not_now" ? "bg-[#eef5f9] text-[#2c5a6e]" : "bg-[#eef0f2] text-[#3f4e5b]";
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-3 text-sm ${tone}`}>
        <span>
          <b>Customer replied: {RESPONSE_LABEL[response]}</b> · {when}
          {note ? ` · “${note}”` : ""}
          {response === "not_now" && " · check-in email scheduled in 30 days"}
        </span>
        {!closed && (
          <span className="flex flex-wrap gap-2">
            {response === "interested" && (
              <>
                <button type="button" disabled={!hydrated || busy} onClick={() => run(() => setStageAction(oppId, "won"), "Marked won.")} className={`${pill} border-[#1f9d55] bg-white text-[#1f9d55]`}>
                  Mark won
                </button>
                <button type="button" disabled={!hydrated || busy} onClick={() => run(() => bookFollowUpAction(oppId), "Follow-up call booked for today + 2.")} className={`${pill} border-[#3a728a] bg-white text-[#3a728a]`}>
                  Book follow-up
                </button>
              </>
            )}
            {response !== "not_now" && (
              <button type="button" disabled={!hydrated || busy} onClick={() => run(() => setStageAction(oppId, "lost"), "Marked lost.")} className={`${pill} border-[#7a8794] bg-white text-[#5a6975]`}>
                Mark lost
              </button>
            )}
          </span>
        )}
        {toast}
      </div>
    );
  }

  if (compact && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 text-xs text-[#3a728a] underline underline-offset-2">
        Customer replied?
      </button>
    );
  }

  return (
    <div className={compact ? "mt-2 flex flex-col gap-2" : "flex flex-col gap-2 rounded-xl border border-[#d9dee3] bg-white px-5 py-3"}>
      {complete && !compact && <p className="text-sm font-semibold text-[#3f4e5b]">Sequence complete, no reply yet</p>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[#3f4e5b]">Customer replied?</span>
        {CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            disabled={!hydrated || busy}
            onClick={() => setChoice(c)}
            aria-pressed={choice === c}
            className={`${pill} ${choice === c ? "border-[#3a728a] bg-[#3a728a] text-white" : "border-[#bcc4cb] text-[#3f4e5b] hover:border-[#3a728a]"}`}
          >
            {RESPONSE_LABEL[c]}
          </button>
        ))}
        {complete && !compact && (
          <button type="button" disabled={!hydrated || busy} onClick={() => run(() => setStageAction(oppId, "lost"), "Marked lost (no response).")} className={`${pill} border-[#7a8794] text-[#5a6975]`}>
            Mark lost (no response)
          </button>
        )}
      </div>
      {choice && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => logResponseAction(oppId, choice, text), `Reply logged: ${RESPONSE_LABEL[choice]}.`);
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder="Optional one-line note"
            aria-label="Note on the reply"
            className="min-w-0 flex-1 rounded-lg border border-[#d9dee3] px-3 py-1.5 text-sm outline-none focus:border-[#3a728a]"
          />
          <button type="submit" disabled={!hydrated || busy} className="rounded-full bg-[#3a728a] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#142e3a] disabled:opacity-50">
            {busy ? "Saving…" : "Log reply"}
          </button>
        </form>
      )}
      {toast}
    </div>
  );
}
