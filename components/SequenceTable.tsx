"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { buildSequenceAction, rescheduleAction, saveStepAction, scheduleAllAction, setStepDoneAction } from "@/app/actions";
import { ResponsePanel } from "./ResponsePanel";
import { useToast } from "./Toast";
import { useHydrated } from "@/lib/useHydrated";

export type SequenceRow = {
  id: string | null; // null for Day 0, which is the opportunity's own email
  day: number;
  due: string;
  channel: string;
  title: string;
  body: string;
  status: string;
  aiOffline: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  Planned: "text-[#7a8794]",
  Scheduled: "text-[#2a6fb5]",
  "Done ✓": "text-[#1f9d55] font-semibold",
  "Sent ✓": "text-[#1f9d55] font-semibold",
  Overdue: "text-[#c47d00] font-semibold",
  Skipped: "text-[#9aa5ae]",
};

const TONES = ["Direct", "Warm", "Technical", "Shorter"] as const;

const CHANNEL_LABEL: Record<string, string> = { email: "Email", call: "Call", text: "Text" };

function StepBody({ row, readOnly }: { row: SequenceRow; readOnly: boolean }) {
  const [body, setBody] = useState(row.body);
  const [saved, setSaved] = useState(row.body);
  const [note, setNote] = useState<string | null>(null);
  // VS-12 T5: the textarea grows to fit the whole step, no inner scrollbar.
  const area = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [body]);
  if (readOnly || row.id === null) {
    return <p className="whitespace-pre-line text-sm leading-relaxed text-[#3f4e5b]">{row.body}</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <textarea
        ref={area}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={async () => {
          if (body === saved) return;
          const r = await saveStepAction(row.id!, body);
          if (r.ok) {
            setSaved(body);
            setNote("Saved.");
          } else setNote(`Not saved: ${r.error}`);
        }}
        rows={3}
        aria-label={`Day ${row.day} ${row.title}`}
        className="resize-none overflow-hidden rounded-lg border border-[#d9dee3] px-3 py-2 text-sm leading-relaxed text-[#3f4e5b] outline-none focus:border-[#3a728a]"
      />
      {note && <p className="text-xs text-[#5a6975]">{note}</p>}
    </div>
  );
}

export function SequenceTable({
  oppId,
  rows,
  built,
  readOnly,
  defaultTone,
  overdue,
  reply,
}: {
  oppId: string;
  rows: SequenceRow[];
  built: boolean;
  readOnly: boolean;
  // VS-12 T6: the tone last used on the opportunity's email, if any.
  defaultTone: string | null;
  // VS-12 T7: some unfinished step is past its date.
  overdue: boolean;
  // VS-12 T8: the inline "Customer replied?" control on done steps.
  reply: { enabled: boolean; logged: boolean; stage: string };
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [busy, startTransition] = useTransition();
  const hydrated = useHydrated();
  const [toast, show] = useToast();
  const [tone, setTone] = useState<string | null>(defaultTone);

  const build = (withTone: string | null = tone) =>
    startTransition(async () => {
      try {
        const r = await buildSequenceAction(oppId, withTone);
        if (!r.ok) show("error", r.error);
        else
          show(
            r.aiOffline ? "neutral" : "success",
            r.aiOffline
              ? "Sequence built from templates (AI offline)."
              : `${built ? "Unsent steps rebuilt" : "Sequence built"}${withTone ? ` in the ${withTone} tone` : ""}.`,
          );
      } catch {
        show("error", "The server did not answer. Nothing changed.");
      }
    });

  const reschedule = () =>
    startTransition(async () => {
      const r = await rescheduleAction(oppId);
      if (!r.ok) show("error", r.error ?? "Could not reschedule.");
      else show("success", "Unfinished steps moved to today, +3 and +7 days.");
    });

  const scheduleAll = () =>
    startTransition(async () => {
      const r = await scheduleAllAction(oppId);
      if (!r.ok) show("error", r.error ?? "Could not schedule.");
      else show("success", "Scheduled. The steps are on your My tasks list.");
    });

  const toggleDone = (id: string, done: boolean) =>
    startTransition(async () => {
      const r = await setStepDoneAction(id, done);
      if (!r.ok) show("error", r.error ?? "Could not update the step.");
    });

  const hasPlanned = rows.some((r) => r.id && r.status === "Planned");

  return (
    <>
      {!readOnly && (
        <div className="mb-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => build()}
            disabled={!hydrated || busy}
            className={
              built
                ? "rounded-full border-2 border-[#3a728a] px-4 py-1.5 text-sm font-semibold text-[#3a728a] transition-opacity duration-150 hover:opacity-80 disabled:opacity-50"
                : "rounded-full bg-[#f55a00] px-5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d94f00] disabled:opacity-60"
            }
          >
            {busy ? "Claude is writing the call, email and text… (about 15 s)" : built ? "Rebuild" : "Build sequence"}
          </button>
          {built && (
            <button
              type="button"
              onClick={scheduleAll}
              disabled={!hydrated || busy || !hasPlanned}
              title={hasPlanned ? undefined : "Every step is already scheduled or done"}
              className="rounded-full bg-[#f55a00] px-5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d94f00] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Schedule all
            </button>
          )}
          {built && overdue && (
            <button
              type="button"
              onClick={reschedule}
              disabled={!hydrated || busy}
              className="rounded-full border-2 border-[#c47d00] px-4 py-1.5 text-sm font-semibold text-[#c47d00] transition-opacity duration-150 hover:opacity-80 disabled:opacity-50"
            >
              Reschedule from today
            </button>
          )}
          <span className="flex flex-wrap items-center gap-2" role="group" aria-label="Sequence tone">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7a8794]">Tone</span>
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                disabled={!hydrated || busy}
                aria-pressed={tone === t}
                title={built ? `Rewrite every step not yet done in the ${t} tone` : `Build the sequence in the ${t} tone`}
                onClick={() => {
                  setTone(t);
                  build(t);
                }}
                className={`rounded-full border px-3 py-1 text-sm transition-colors duration-150 disabled:opacity-50 ${
                  tone === t ? "border-[#3a728a] bg-[#3a728a] text-white" : "border-[#bcc4cb] text-[#3f4e5b] hover:border-[#3a728a] hover:text-[#3a728a]"
                }`}
              >
                {t}
              </button>
            ))}
          </span>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-[#e3e7eb] bg-white shadow-[0_2px_8px_rgba(15,20,25,0.06)]">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-[#efefef] text-left text-[#3f4e5b]">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Day</th>
              <th className="px-3 py-2.5 font-semibold">Due</th>
              <th className="px-3 py-2.5 font-semibold">Channel</th>
              <th className="px-3 py-2.5 font-semibold">Step</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const expanded = open === r.day;
              return (
                <tr key={r.day} className="border-t border-[#eef0f2] align-top">
                  <td className="px-4 py-3 font-semibold tabular-nums">{r.day}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#5a6975]">{r.due}</td>
                  <td className="px-3 py-3">{CHANNEL_LABEL[r.channel] ?? r.channel}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : r.day)}
                      aria-expanded={expanded}
                      className="text-left font-medium text-[#3a728a] hover:underline"
                    >
                      {expanded ? "▾" : "▸"} {r.title}
                    </button>
                    {r.aiOffline && <span className="ml-2 rounded bg-[#fcf1d9] px-1.5 py-0.5 text-xs text-[#8a5a00]">AI offline</span>}
                    {expanded && (
                      <div className="mt-2">
                        {/* Keyed on the text so a Rebuild or tone change shows the new step. */}
                        <StepBody key={r.body} row={r} readOnly={readOnly} />
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={STATUS_STYLE[r.status] ?? ""}>{r.status}</span>
                    {!readOnly && r.id && r.status !== "Planned" && r.status !== "Skipped" && (
                      <button
                        type="button"
                        onClick={() => toggleDone(r.id!, r.status !== "Done ✓")}
                        disabled={!hydrated || busy}
                        className="ml-3 text-xs text-[#3a728a] underline underline-offset-2 disabled:opacity-50"
                      >
                        {r.status === "Done ✓" ? "Undo" : "Mark done"}
                      </button>
                    )}
                    {!readOnly && !reply.logged && (r.status === "Done ✓" || r.status === "Sent ✓") && (
                      <ResponsePanel
                        oppId={oppId}
                        response={null}
                        respondedAt={null}
                        note={null}
                        stage={reply.stage}
                        complete={false}
                        enabled={reply.enabled}
                        compact
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {toast}
    </>
  );
}
