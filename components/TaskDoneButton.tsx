"use client";

import { useTransition } from "react";
import { setStepDoneAction } from "@/app/actions";
import { useHydrated } from "@/lib/useHydrated";

export function TaskDoneButton({ stepId }: { stepId: string }) {
  const [busy, startTransition] = useTransition();
  const hydrated = useHydrated();
  return (
    <button
      type="button"
      disabled={!hydrated || busy}
      onClick={() => startTransition(async () => void (await setStepDoneAction(stepId, true)))}
      className="whitespace-nowrap rounded-full border border-[#1f9d55] px-3 py-1 text-xs font-semibold text-[#1f9d55] transition-colors duration-150 hover:bg-[#1f9d55] hover:text-white disabled:opacity-50"
    >
      {busy ? "Saving…" : "Mark done"}
    </button>
  );
}
