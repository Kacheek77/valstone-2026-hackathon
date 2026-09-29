"use client";

import { useState, useTransition } from "react";
import { resetDemoAction } from "@/app/actions";

export function ResetDemoButton() {
  const [busy, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          startTransition(async () => {
            try {
              setResult(await resetDemoAction());
            } catch {
              setResult({ ok: false, message: "The reset did not reach the server." });
            }
          })
        }
        className="rounded-full border-2 border-[#d23b3b] px-4 py-1.5 text-sm font-semibold text-[#d23b3b] transition-colors duration-150 hover:bg-[#d23b3b] hover:text-white disabled:opacity-50"
      >
        {busy ? "Resetting…" : "Reset demo"}
      </button>
      {result && <p className={`text-sm ${result.ok ? "text-[#1f9d55]" : "text-[#8f2424]"}`}>{result.message}</p>}
    </div>
  );
}
