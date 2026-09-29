"use client";

import { useEffect, useRef, useState } from "react";
import { saveVoiceNoteAction } from "@/app/actions";

type Option = { value: string; label: string };

// Pill menu: Manager + the six reps, then "My voice" for the current rep.
// Choosing a view goes through /view, which sets the sd_view cookie.
export function ViewSwitcher({
  options,
  selected,
  voice,
}: {
  options: Option[];
  selected: string;
  // Present when the selected view is a rep: their id and current voice note.
  voice: { repId: string; note: string | null } | null;
}) {
  const [open, setOpen] = useState(false);
  const [editingVoice, setEditingVoice] = useState(false);
  const [note, setNote] = useState(voice?.note ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const saved = useRef(voice?.note ?? "");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingVoice(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setEditingVoice(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === selected)?.label ?? "Switch view";

  const go = (value: string) => {
    // Full navigation on purpose: /view is a route handler that sets a cookie
    // and redirects, not a page the client router can render.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/view?as=${encodeURIComponent(value)}`);
  };

  const saveNote = async () => {
    if (!voice || note === saved.current) return;
    const r = await saveVoiceNoteAction(voice.repId, note);
    if (r.ok) {
      saved.current = note;
      setStatus("Saved. New drafts and rewrites use it.");
    } else {
      setStatus(`Not saved: ${r.error}`);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-white/15 py-1.5 pl-4 pr-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-[#f55a00]"
      >
        {current}
        <span aria-hidden className="text-xs">▾</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-50 w-72 overflow-hidden rounded-xl border border-[#d9dee3] bg-white text-sm text-[#0f1419] shadow-xl">
          {!editingVoice ? (
            <>
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="menuitem"
                  onClick={() => go(o.value)}
                  className={`block w-full px-4 py-2 text-left transition-colors duration-150 hover:bg-[#f6f7f8] ${o.value === selected ? "font-semibold text-[#3a728a]" : ""}`}
                >
                  {o.label}
                  {o.value === selected && <span className="float-right">✓</span>}
                </button>
              ))}
              {voice && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setEditingVoice(true)}
                  className="block w-full border-t border-[#eef0f2] px-4 py-2 text-left text-[#3a728a] transition-colors duration-150 hover:bg-[#f6f7f8]"
                >
                  My voice…
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2 p-4">
              <p className="font-semibold">My voice</p>
              <p className="text-xs text-[#5a6975]">How your drafts should sound. Every new draft and rewrite follows it.</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={saveNote}
                rows={4}
                maxLength={500}
                placeholder="e.g. Short sentences. Sign off 'Talk soon.'"
                aria-label="My voice"
                className="rounded-lg border border-[#d9dee3] px-3 py-2 outline-none focus:border-[#3a728a]"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5a6975]">{status ?? "Saves when you click away."}</span>
                <button type="button" onClick={() => setEditingVoice(false)} className="text-[#3a728a] underline">
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
