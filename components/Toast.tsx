"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

export type ToastTone = "success" | "neutral" | "error";
type Toast = { tone: ToastTone; text: ReactNode; id: number };

const TONE: Record<ToastTone, string> = {
  success: "border-[#1f9d55] bg-[#e6f4ec] text-[#14693a]",
  neutral: "border-[#bcc4cb] bg-white text-[#3f4e5b]",
  error: "border-[#d23b3b] bg-[#fbe5e5] text-[#8f2424]",
};

// One toast at a time, bottom right, gone after 5 seconds.
export function useToast(): [ReactNode, (tone: ToastTone, text: ReactNode) => void] {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const show = useCallback((tone: ToastTone, text: ReactNode) => setToast({ tone, text, id: Date.now() }), []);

  const node = toast ? (
    <div
      key={toast.id}
      role="status"
      className={`sd-toast fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border-l-4 px-4 py-3 text-sm shadow-lg ${TONE[toast.tone]}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">{toast.text}</div>
        <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
          ×
        </button>
      </div>
    </div>
  ) : null;

  return [node, show];
}
