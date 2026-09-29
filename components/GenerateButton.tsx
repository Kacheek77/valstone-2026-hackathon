"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { finishSignalAction } from "@/app/actions";
import type { GenerateResult } from "@/lib/generate";

const CONCURRENCY = 3;

async function generate(signalId: string, accountId: string): Promise<GenerateResult> {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signalId, accountId }),
    });
    return (await res.json()) as GenerateResult;
  } catch {
    return { ok: false, error: "The server did not answer." };
  }
}

// Scores three accounts at a time through /api/generate, so the ranked table
// fills in row by row instead of waiting for the whole batch.
export function GenerateButton({
  signalId,
  pendingAccountIds,
  total,
  leads,
}: {
  signalId: string;
  pendingAccountIds: string[];
  total: number;
  leads: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [offline, setOffline] = useState(0);
  const [batch, setBatch] = useState(0);

  if (!running && pendingAccountIds.length === 0) {
    return leads > 0 ? (
      <Link
        href={`/pipeline?signal=${signalId}`}
        className="inline-flex whitespace-nowrap rounded-full border-2 border-[#1f9d55] px-5 py-2 text-sm font-semibold text-[#1f9d55] transition-opacity duration-150 hover:opacity-80"
      >
        View {leads} lead{leads === 1 ? "" : "s"} →
      </Link>
    ) : null;
  }

  const run = async () => {
    setRunning(true);
    setDone(0);
    setFailed([]);
    setOffline(0);
    setBatch(pendingAccountIds.length);
    const queue = [...pendingAccountIds];
    const worker = async () => {
      while (queue.length > 0) {
        const id = queue.shift()!;
        const r = await generate(signalId, id);
        if (!r.ok) setFailed((f) => [...f, r.error]);
        else if (r.aiOffline) setOffline((n) => n + 1);
        setDone((n) => n + 1);
        router.refresh();
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    try {
      await finishSignalAction(signalId);
    } catch {
      // Cosmetic status only.
    }
    setRunning(false);
    router.refresh();
  };

  const count = pendingAccountIds.length;
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="whitespace-nowrap rounded-full bg-[#f55a00] px-5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d94f00] disabled:cursor-wait disabled:opacity-70"
      >
        {running ? `Scoring ${done} of ${batch}…` : `Generate leads (${count === total ? total : `${count} of ${total}`})`}
      </button>
      {offline > 0 && <p className="text-xs text-[#5a6975]">AI offline for {offline}: rules-based scores used.</p>}
      {failed.length > 0 && !running && (
        <p className="max-w-xs text-right text-xs text-[#8f2424]">
          {failed.length} could not be saved ({failed[0]}). Click again to retry.
        </p>
      )}
    </div>
  );
}
