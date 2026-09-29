"use client";

import { useEffect, useState, useTransition } from "react";
import { refreshAction } from "@/app/actions";

type Toast = { tone: "success" | "neutral" | "error"; text: string };

const TONE: Record<Toast["tone"], string> = {
  success: "border-[#1f9d55] bg-[#e6f4ec] text-[#14693a]",
  neutral: "border-[#bcc4cb] bg-white text-[#3f4e5b]",
  error: "border-[#d23b3b] bg-[#fbe5e5] text-[#8f2424]",
};

export function RefreshButton({ demo }: { demo: boolean }) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const onClick = () =>
    startTransition(async () => {
      try {
        const r = await refreshAction(demo);
        if (!r.ok) setToast({ tone: "error", text: r.message });
        else setToast({ tone: r.inserted > 0 ? "success" : "neutral", text: r.message });
      } catch {
        setToast({ tone: "error", text: "Refresh could not reach the server. Showing the signals already loaded." });
      }
    });

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-full bg-[#f55a00] px-5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d94f00] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Checking the weather…" : "Refresh signals"}
      </button>
      {toast && (
        <div
          role="status"
          className={`sd-toast fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border-l-4 px-4 py-3 text-sm shadow-lg ${TONE[toast.tone]}`}
        >
          <div className="flex items-start gap-3">
            <p className="flex-1">{toast.text}</p>
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
