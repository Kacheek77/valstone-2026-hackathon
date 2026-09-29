"use server";

import { revalidatePath } from "next/cache";
import { scoreAndDraft } from "@/lib/claude";
import { leadWithFor } from "@/lib/match";
import { amountFor, DEFAULT_PRICES } from "@/lib/pricing";
import { refreshSignals, type RefreshResult } from "@/lib/signals-refresh";
import { getSupabase } from "@/lib/supabase";
import type { Account, PriceList, Signal } from "@/lib/types";

export async function refreshAction(demo: boolean): Promise<RefreshResult> {
  const result = await refreshSignals({ demo });
  if (result.ok && result.inserted > 0) {
    revalidatePath("/dashboard");
    revalidatePath("/team");
  }
  return result;
}

export type GenerateResult = { ok: true; aiOffline: boolean } | { ok: false; error: string };

// Score and draft one account for one signal, then save it as a draft
// opportunity. Called once per account by the Generate button, so rows appear
// as they finish. Safe to repeat: an existing opportunity is left alone.
export async function generateOneAction(
  signalId: string,
  accountId: string,
): Promise<GenerateResult> {
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
    if (existing.data && existing.data.length > 0) return { ok: true, aiOffline: false };

    const signal = sig.data as Signal;
    const account = acc.data as Account;
    const leadWith = leadWithFor(account, signal);
    if (!leadWith) return { ok: false, error: `${account.name} already owns every module.` };

    const { data: rep } = await db.from("reps").select("name").eq("id", signal.rep_id ?? 1).maybeSingle();
    const prices = (settings.data?.price_list as PriceList | undefined) ?? DEFAULT_PRICES;
    const draft = await scoreAndDraft(account, signal, leadWith, rep?.name ?? "Dana Whitfield");

    const { error } = await db.from("opportunities").upsert(
      {
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
      },
      { onConflict: "signal_id,account_id", ignoreDuplicates: true },
    );
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/signals/${signalId}`);
    return { ok: true, aiOffline: draft.ai_offline };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function finishSignalAction(signalId: string): Promise<void> {
  try {
    await getSupabase().from("signals").update({ status: "processed" }).eq("id", signalId);
  } catch {
    // Status is cosmetic; the opportunities are already saved.
  }
  revalidatePath(`/signals/${signalId}`);
  revalidatePath("/dashboard");
  revalidatePath("/team");
}
