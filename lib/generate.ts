import { scoreAndDraft } from "./claude";
import { withDerivedStatus } from "./data";
import { formatId, nextIdNumber, UNIQUE_VIOLATION } from "./ids";
import { leadWithFor } from "./match";
import { amountFor, DEFAULT_PRICES } from "./pricing";
import { getSupabase } from "./supabase";
import type { Account, Opportunity, PriceList, Signal } from "./types";

// The saved row, so the signal page can animate it in without a reload (VS-12 T11).
export type ScoredOpp = Pick<Opportunity, "id" | "score" | "why_now" | "amount" | "lead_with" | "ai_offline" | "promoted">;
export type GenerateResult = { ok: true; aiOffline: boolean; opp: ScoredOpp | null } | { ok: false; error: string };

const SCORED_FIELDS = "id,score,why_now,amount,lead_with,ai_offline,promoted";

// The lowest-id opportunity for the pair: the one that stands if two runs raced.
async function firstForPair(signalId: string, accountId: string): Promise<ScoredOpp | null> {
  const { data } = await getSupabase()
    .from("opportunities")
    .select(SCORED_FIELDS)
    .eq("signal_id", signalId)
    .eq("account_id", accountId)
    .order("id", { ascending: true })
    .limit(1);
  return ((data ?? [])[0] as ScoredOpp | undefined) ?? null;
}

// Score and draft one account for one signal, then save it as a draft
// opportunity. Safe to repeat: an existing opportunity is left alone.
export async function generateOne(signalId: string, accountId: string): Promise<GenerateResult> {
  try {
    const db = getSupabase();
    const [sig, acc, existing, settings] = await Promise.all([
      db.from("signals").select("*").eq("id", signalId).maybeSingle(),
      db.from("accounts").select("*").eq("id", accountId).maybeSingle(),
      db.from("opportunities").select("id").eq("signal_id", signalId).eq("account_id", accountId).limit(1),
      db.from("settings").select("price_list").eq("id", 1).maybeSingle(),
    ]);
    const err = sig.error ?? acc.error ?? existing.error;
    if (err) return { ok: false, error: err.message };
    if (!sig.data || !acc.data) return { ok: false, error: "Signal or account not found." };
    // Already scored (another tab, a refresh mid-run): skip, return what is there.
    if (existing.data && existing.data.length > 0) return { ok: true, aiOffline: false, opp: await firstForPair(signalId, accountId) };

    const signal = sig.data as Signal;
    const account = await withDerivedStatus(acc.data as Account);
    const leadWith = leadWithFor(account, signal);
    if (!leadWith) return { ok: false, error: `${account.name} already owns every module.` };

    const { data: rep } = await db.from("reps").select("*").eq("id", signal.rep_id ?? "").maybeSingle();
    const prices = (settings.data?.price_list as PriceList | undefined) ?? DEFAULT_PRICES;
    const draft = await scoreAndDraft(account, signal, leadWith, {
      name: rep?.name ?? "Jordan Ellsworth",
      voice_note: rep?.voice_note ?? null,
    });
    const territory: string[] = rep?.counties ?? [];

    const row = {
      signal_id: signal.id,
      account_id: account.id,
      rep_id: signal.rep_id,
      score: draft.score,
      lead_with: leadWith,
      why_now: draft.why_now,
      email_subject: draft.email_subject,
      email_body: draft.email_body,
      amount: amountFor(leadWith, account.acres, prices),
      stage: "draft",
      ai_offline: draft.ai_offline,
      is_signal_driven: true,
      is_off_territory: !territory.includes(`${account.county}, ${account.state}`),
    };

    // OPP- + next number. Three generations run at once, so two can pick the
    // same id; on a clash, check whether this pair already exists, else retry.
    for (let attempt = 0; attempt < 6; attempt++) {
      const id = formatId("OPP", (await nextIdNumber("opportunities", "OPP")) + attempt);
      const { error } = await db.from("opportunities").insert({ id, ...row });
      if (!error) {
        // Two runs can pass the "already scored" check together (two tabs, or a
        // refresh mid-run). The lowest id stands; a later duplicate removes itself.
        const first = await firstForPair(signal.id, account.id);
        if (first && first.id !== id) {
          await db.from("opportunities").delete().eq("id", id);
          return { ok: true, aiOffline: first.ai_offline, opp: first };
        }
        return {
          ok: true,
          aiOffline: draft.ai_offline,
          opp: { id, score: row.score, why_now: row.why_now, amount: row.amount, lead_with: row.lead_with, ai_offline: row.ai_offline, promoted: false },
        };
      }
      if (error.code !== UNIQUE_VIOLATION) return { ok: false, error: error.message };
      const { data: dup } = await db
        .from("opportunities")
        .select("id")
        .eq("signal_id", signal.id)
        .eq("account_id", account.id)
        .limit(1);
      if (dup && dup.length > 0) return { ok: true, aiOffline: draft.ai_offline, opp: await firstForPair(signal.id, account.id) };
    }
    return { ok: false, error: "Could not allocate an opportunity id." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
