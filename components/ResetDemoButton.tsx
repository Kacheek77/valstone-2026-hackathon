"use client";

import { useState, useTransition } from "react";
import { resetDemoAction } from "@/app/actions";
import { useHydrated } from "@/lib/useHydrated";

// Two steps inline ("Reset demo" → "Confirm reset") instead of window.confirm,
// so it works in any browser and under automation.
export function ResetDemoButton() {
  const hydrated = useHydrated();
  const [busy, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const run = () => {
    setArmed(false);
    startTransition(async () => {
      try {
        setResult(await resetDemoAction());
      } catch {
        setResult({ ok: false, message: "The reset did not reach the server." });
      }
    });
  };

  const outline =
    "rounded-full border-2 border-[#d23b3b] px-4 py-1.5 text-sm font-semibold transition-colors duration-150 disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-3">
      {armed ? (
        <>
          <button type="button" onClick={run} disabled={!hydrated || busy} className={`${outline} bg-[#d23b3b] text-white hover:bg-[#b32f2f]`}>
            Confirm reset
          </button>
          <button type="button" onClick={() => setArmed(false)} className="text-sm text-[#5a6975] underline underline-offset-2">
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setArmed(true);
          }}
          disabled={!hydrated || busy}
          className={`${outline} text-[#d23b3b] hover:bg-[#d23b3b] hover:text-white`}
        >
          {busy ? "Resetting…" : "Reset demo"}
        </button>
      )}
      {result && <p className={`text-sm ${result.ok ? "text-[#1f9d55]" : "text-[#8f2424]"}`}>{result.message}</p>}
    </div>
  );
}
