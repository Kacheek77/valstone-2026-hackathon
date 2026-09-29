"use client";

import { useState, useTransition } from "react";
import { promoteAction } from "@/app/actions";

// Promote a below-threshold opportunity to a lead, or undo it.
export function PromoteButton({ oppId, promoted }: { oppId: string; promoted: boolean }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toggle = () =>
    startTransition(async () => {
      setError(null);
      const r = await promoteAction(oppId, !promoted);
      if (!r.ok) setError(r.error ?? "Could not save.");
    });
  return (
    <span className="relative z-10 inline-flex flex-col items-start">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors duration-150 disabled:opacity-50 ${
          promoted ? "bg-[#e6f4ec] text-[#14693a] hover:bg-[#d3ecdd]" : "border border-[#3a728a] text-[#3a728a] hover:bg-[#3a728a] hover:text-white"
        }`}
      >
        {busy ? "Saving…" : promoted ? "Promoted ✓ · undo" : "Promote to lead"}
      </button>
      {error && <span className="mt-0.5 text-xs text-[#8f2424]">{error}</span>}
    </span>
  );
}
