import type { GenerateResult } from "@/lib/generate";

const CONCURRENCY = 3;

async function generateOne(signalId: string, accountId: string): Promise<GenerateResult> {
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

export type GenerateSummary = { done: number; failed: string[]; offline: number };

// Scores accounts three at a time through /api/generate (route handlers run in
// parallel; server actions from one page do not). onStep fires after each one.
export async function runGenerate(
  signalId: string,
  accountIds: string[],
  onStep: (summary: GenerateSummary) => void,
): Promise<GenerateSummary> {
  const summary: GenerateSummary = { done: 0, failed: [], offline: 0 };
  const queue = [...accountIds];
  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift()!;
      const r = await generateOne(signalId, id);
      if (!r.ok) summary.failed.push(r.error);
      else if (r.aiOffline) summary.offline++;
      summary.done++;
      onStep({ ...summary, failed: [...summary.failed] });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return summary;
}
