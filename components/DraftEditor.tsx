"use client";

import { useRef, useState, useTransition } from "react";
import { resetEmailAction, rewriteEmailAction, saveDraftAction } from "@/app/actions";

const TONES = ["Direct", "Warm", "Technical", "Shorter"] as const;

export function DraftEditor({
  oppId,
  subject: initialSubject,
  body: initialBody,
  historyLength: initialHistory,
  readOnly = false,
}: {
  oppId: string;
  subject: string;
  body: string;
  historyLength: number;
  // Closed (won or lost) opportunities: plain text, no editing, Copy only.
  readOnly?: boolean;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [history, setHistory] = useState(initialHistory);
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, startTransition] = useTransition();
  const saved = useRef({ subject: initialSubject, body: initialBody });

  const save = async () => {
    if (subject === saved.current.subject && body === saved.current.body) return;
    const r = await saveDraftAction(oppId, subject, body);
    if (r.ok) {
      saved.current = { subject, body };
      setStatus({ tone: "ok", text: "Draft saved." });
    } else {
      setStatus({ tone: "error", text: `Not saved: ${r.error}` });
    }
  };

  const apply = (req: { tone?: string; instruction?: string }) =>
    startTransition(async () => {
      setStatus(null);
      try {
        const r = await rewriteEmailAction(oppId, { subject, body }, req);
        if (!r.ok) {
          setStatus({ tone: "error", text: r.error });
          return;
        }
        setSubject(r.subject);
        setBody(r.body);
        saved.current = { subject: r.subject, body: r.body };
        setHistory(r.historyLength);
        setOffline(r.aiOffline);
        setStatus(r.note ? { tone: "warn", text: r.note } : { tone: "ok", text: req.tone ? `Rewritten: ${req.tone}.` : "Instruction applied." });
        if (req.instruction) setInstruction("");
      } catch {
        setStatus({ tone: "error", text: "The rewrite did not reach the server. Your draft is unchanged." });
      }
    });

  const reset = () =>
    startTransition(async () => {
      const r = await resetEmailAction(oppId);
      if (!r.ok) {
        setStatus({ tone: "error", text: r.error });
        return;
      }
      setSubject(r.subject);
      setBody(r.body);
      saved.current = { subject: r.subject, body: r.body };
      setHistory(0);
      setOffline(false);
      setStatus({ tone: "ok", text: "Back to the original draft." });
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setStatus({ tone: "ok", text: "Email copied to the clipboard." });
    } catch {
      setStatus({ tone: "warn", text: "Copy was blocked by the browser. Select the text and copy it instead." });
    }
  };

  const statusColor = { ok: "text-[#1f9d55]", warn: "text-[#8a5a00]", error: "text-[#8f2424]" };

  if (readOnly) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-semibold">{subject}</p>
        <p className="whitespace-pre-line leading-relaxed text-[#3f4e5b]">{body}</p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <button
            type="button"
            onClick={copy}
            className="rounded-full border border-[#3a728a] px-4 py-1.5 font-semibold text-[#3a728a] transition-colors duration-150 hover:bg-[#3a728a] hover:text-white"
          >
            Copy email
          </button>
          {status && <p className={statusColor[status.tone]}>{status.text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#7a8794]">Tone</span>
        {TONES.map((t) => (
          <button
            key={t}
            type="button"
            disabled={busy}
            onClick={() => apply({ tone: t })}
            className="rounded-full border border-[#bcc4cb] px-3 py-1 text-sm text-[#3f4e5b] transition-colors duration-150 hover:border-[#3a728a] hover:text-[#3a728a] disabled:opacity-50"
          >
            {t}
          </button>
        ))}
        {offline && <span className="rounded bg-[#fcf1d9] px-1.5 py-0.5 text-xs text-[#8a5a00]">AI offline</span>}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (instruction.trim()) apply({ instruction: instruction.trim() });
        }}
      >
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Tell Claude what to change"
          aria-label="Tell Claude what to change"
          maxLength={300}
          className="min-w-0 flex-1 rounded-lg border border-[#d9dee3] px-3 py-1.5 text-sm outline-none focus:border-[#3a728a]"
        />
        <button
          type="submit"
          disabled={busy || !instruction.trim()}
          className="rounded-full bg-[#3a728a] px-4 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#142e3a] disabled:opacity-50"
        >
          {busy ? "Working…" : "Apply"}
        </button>
      </form>

      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        onBlur={save}
        aria-label="Email subject"
        disabled={busy}
        className="rounded-lg border border-[#d9dee3] px-3 py-2 font-semibold outline-none focus:border-[#3a728a] disabled:bg-[#f6f7f8]"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={save}
        aria-label="Email body"
        rows={12}
        disabled={busy}
        className="rounded-lg border border-[#d9dee3] px-3 py-2 leading-relaxed text-[#3f4e5b] outline-none focus:border-[#3a728a] disabled:bg-[#f6f7f8]"
      />

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-[#3a728a] px-4 py-1.5 font-semibold text-[#3a728a] transition-colors duration-150 hover:bg-[#3a728a] hover:text-white"
        >
          Copy email
        </button>
        {history > 0 && (
          <button type="button" onClick={reset} disabled={busy} className="text-[#3a728a] underline underline-offset-2 hover:text-[#142e3a]">
            Reset to original
          </button>
        )}
        {status && <p className={statusColor[status.tone]}>{status.text}</p>}
      </div>
    </div>
  );
}
