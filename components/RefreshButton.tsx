"use client";

import { useTransition } from "react";
import { refreshAction } from "@/app/actions";
import { useToast } from "./Toast";

// Three outcomes: new signals (green), nothing new (neutral), source failed (red).
export function RefreshButton({ demo }: { demo: boolean }) {
  const [pending, startTransition] = useTransition();
  const [toast, show] = useToast();

  const onClick = () =>
    startTransition(async () => {
      try {
        const r = await refreshAction(demo);
        if (!r.ok) show("error", r.message);
        else show(r.inserted > 0 ? "success" : "neutral", r.message);
      } catch {
        show("error", "Refresh could not reach the server. Showing the signals already loaded.");
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
      {toast}
    </>
  );
}
