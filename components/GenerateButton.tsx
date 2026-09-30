"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { finishSignalAction } from "@/app/actions";
import { runGenerate } from "./runGenerate";
import { useHydrated } from "@/lib/useHydrated";

const primaryClass =
  "whitespace-nowrap rounded-full bg-[#f55a00] px-5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d94f00] disabled:cursor-wait disabled:opacity-70";

// Signal page: scores the pending accounts and refreshes after each one, so
// the ranked table fills in row by row.
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
  const hydrated = useHydrated();
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
    await runGenerate(signalId, pendingAccountIds, (s) => {
      setDone(s.done);
      setFailed(s.failed);
      setOffline(s.offline);
      router.refresh();
    });
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
      <button type="button" onClick={run} disabled={!hydrated || running} className={primaryClass}>
        {running ? `Scoring ${done} of ${batch}…` : `Score & generate leads (${count === total ? total : `${count} of ${total}`})`}
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

// Tweak 7, dashboard card: scores in place with progress on the card, then
// opens the signal page already populated.
export function CardGenerateButton({ signalId, pendingAccountIds }: { signalId: string; pendingAccountIds: string[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const hydrated = useHydrated();
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    const s = await runGenerate(signalId, pendingAccountIds, (p) => setDone(p.done));
    try {
      await finishSignalAction(signalId);
    } catch {
      // Cosmetic status only.
    }
    if (s.failed.length === pendingAccountIds.length && s.failed.length > 0) {
      setRunning(false);
      setError(s.failed[0]);
      return;
    }
    router.push(`/signals/${signalId}`);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={run} disabled={!hydrated || running} className={primaryClass}>
        {running ? `Scoring ${done} of ${pendingAccountIds.length}…` : `Score & generate leads (${pendingAccountIds.length})`}
      </button>
      {error && <p className="max-w-[220px] text-right text-xs text-[#8f2424]">{error}</p>}
    </div>
  );
}
