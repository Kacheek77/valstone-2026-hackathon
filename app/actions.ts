"use server";

import { revalidatePath } from "next/cache";
import { rewriteEmail, type RewriteRequest } from "@/lib/claude";
import { buildSequence } from "@/lib/sequence";
import { refreshSignals, type RefreshResult } from "@/lib/signals-refresh";
import { getSupabase } from "@/lib/supabase";
import { SEQUENCE_DAYS, type Account, type Opportunity, type OutreachStep, type Rep, type Signal, type Stage } from "@/lib/types";

// The dataset is small and every page reads all of it, so any write
// revalidates the whole app.
function revalidateAll() {
  revalidatePath("/", "layout");
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const OPP_ID = /^OPP-\d{4}$/;

async function loadOpp(oppId: string) {
  if (!OPP_ID.test(oppId)) throw new Error("Unknown opportunity.");
  const db = getSupabase();
  const { data: opp, error } = await db.from("opportunities").select("*").eq("id", oppId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!opp) throw new Error("Opportunity not found.");
  const o = opp as Opportunity;
  const [acc, sig, rep] = await Promise.all([
    db.from("accounts").select("*").eq("id", o.account_id).maybeSingle(),
    o.signal_id ? db.from("signals").select("*").eq("id", o.signal_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("reps").select("*").eq("id", o.rep_id ?? "").maybeSingle(),
  ]);
  if (!acc.data) throw new Error("Account not found.");
  return { opp: o, account: acc.data as Account, signal: (sig.data as Signal | null) ?? null, rep: (rep.data as Rep | null) ?? null };
}

// ---------------------------------------------------------------- signals

export async function refreshAction(demo: boolean): Promise<RefreshResult> {
  const result = await refreshSignals({ demo });
  if (result.ok && result.inserted > 0) revalidateAll();
  return result;
}

export async function finishSignalAction(signalId: string): Promise<void> {
  try {
    await getSupabase().from("signals").update({ status: "processed" }).eq("id", signalId);
  } catch {
    // Status is cosmetic; the opportunities are already saved.
  }
  revalidateAll();
}

export async function promoteAction(oppId: string, promoted: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!OPP_ID.test(oppId)) return { ok: false, error: "Unknown opportunity." };
  const { error } = await getSupabase().from("opportunities").update({ promoted }).eq("id", oppId);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------- drafts

export async function saveDraftAction(oppId: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!OPP_ID.test(oppId)) return { ok: false, error: "Unknown opportunity." };
  const { error } = await getSupabase()
    .from("opportunities")
    .update({ email_subject: subject.slice(0, 300), email_body: body.slice(0, 5000) })
    .eq("id", oppId);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export type RewriteActionResult =
  | { ok: true; subject: string; body: string; aiOffline: boolean; note?: string; historyLength: number }
  | { ok: false; error: string };

// current: the draft as it stands in the editor, which may hold unsaved edits.
export async function rewriteEmailAction(
  oppId: string,
  current: { subject: string; body: string },
  req: RewriteRequest,
): Promise<RewriteActionResult> {
  try {
    const { opp, account, signal, rep } = await loadOpp(oppId);
    const result = await rewriteEmail(
      account,
      signal,
      opp.lead_with,
      { name: rep?.name ?? "Your rep", voice_note: rep?.voice_note ?? null },
      current,
      { tone: req.tone, instruction: req.instruction?.slice(0, 300) },
    );
    const history = opp.email_history ?? [];
    const unchanged = result.email_body === current.body && result.email_subject === current.subject;
    if (unchanged) {
      return { ok: true, subject: current.subject, body: current.body, aiOffline: result.ai_offline, note: result.note, historyLength: history.length };
    }
    const nextHistory = [
      ...history,
      { subject: current.subject, body: current.body, at: new Date().toISOString(), note: req.tone ?? "instruction" },
    ];
    const { error } = await getSupabase()
      .from("opportunities")
      .update({ email_subject: result.email_subject, email_body: result.email_body, email_history: nextHistory })
      .eq("id", oppId);
    if (error) return { ok: false, error: `Could not save the rewrite (${error.message}).` };
    revalidateAll();
    return {
      ok: true,
      subject: result.email_subject,
      body: result.email_body,
      aiOffline: result.ai_offline,
      note: result.note,
      historyLength: nextHistory.length,
    };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function resetEmailAction(oppId: string): Promise<RewriteActionResult> {
  try {
    const { opp } = await loadOpp(oppId);
    const original = opp.email_history?.[0];
    if (!original) return { ok: true, subject: opp.email_subject, body: opp.email_body, aiOffline: false, historyLength: 0 };
    const { error } = await getSupabase()
      .from("opportunities")
      .update({ email_subject: original.subject, email_body: original.body, email_history: [] })
      .eq("id", oppId);
    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true, subject: original.subject, body: original.body, aiOffline: false, historyLength: 0 };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

// ---------------------------------------------------------------- stages

// VS-7: Signal Desk is standalone. Accepting a lead moves it into the rep's
// pipeline (internal stage "pushed", shown as "Accepted") and starts the clock
// for the outreach sequence. Nothing leaves the app.
export async function acceptLeadAction(oppId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { opp } = await loadOpp(oppId);
    if (opp.stage !== "draft") return { ok: true };
    const { error } = await getSupabase()
      .from("opportunities")
      .update({ stage: "pushed", pushed_at: opp.pushed_at ?? new Date().toISOString() })
      .eq("id", oppId);
    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

// "sent" from a closed stage is the Reopen correction; it keeps the original sent_at.
export async function setStageAction(oppId: string, stage: Extract<Stage, "sent" | "won" | "lost">): Promise<{ ok: boolean; error?: string }> {
  if (!OPP_ID.test(oppId)) return { ok: false, error: "Unknown opportunity." };
  const update: Record<string, unknown> = { stage };
  if (stage === "sent") {
    const { data } = await getSupabase().from("opportunities").select("sent_at").eq("id", oppId).maybeSingle();
    if (!data?.sent_at) update.sent_at = new Date().toISOString();
  }
  const { error } = await getSupabase().from("opportunities").update(update).eq("id", oppId);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------- sequence

const STEP_ID = /^[0-9a-f-]{36}$/i;

export type SequenceResult = { ok: true; aiOffline: boolean } | { ok: false; error: string };

// Build the sequence, or Rebuild it: regenerates every step not yet done and
// leaves done steps (and their status) alone.
export async function buildSequenceAction(oppId: string): Promise<SequenceResult> {
  try {
    const { opp, account, signal, rep } = await loadOpp(oppId);
    if (opp.stage === "won" || opp.stage === "lost") return { ok: false, error: "This opportunity is closed." };
    const db = getSupabase();
    const { data: existing, error: readErr } = await db.from("outreach_steps").select("*").eq("opportunity_id", oppId);
    if (readErr) return { ok: false, error: `Sequences are not available yet (${readErr.message}).` };
    const byDay = new Map(((existing ?? []) as OutreachStep[]).map((s) => [s.day, s]));
    if (SEQUENCE_DAYS.every((d) => byDay.get(d)?.status === "done")) return { ok: true, aiOffline: false };

    const draft = await buildSequence(account, signal, opp, { name: rep?.name ?? "Your rep", voice_note: rep?.voice_note ?? null });
    for (const step of draft.steps) {
      const prev = byDay.get(step.day);
      if (prev?.status === "done") continue;
      const row = { title: step.title, body: step.body, channel: step.channel, ai_offline: draft.ai_offline };
      const { error } = prev
        ? await db.from("outreach_steps").update(row).eq("id", prev.id)
        : await db.from("outreach_steps").insert({ opportunity_id: oppId, day: step.day, status: "planned", ...row });
      if (error) return { ok: false, error: error.message };
    }
    revalidateAll();
    return { ok: true, aiOffline: draft.ai_offline };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function scheduleAllAction(oppId: string): Promise<{ ok: boolean; error?: string }> {
  if (!OPP_ID.test(oppId)) return { ok: false, error: "Unknown opportunity." };
  const { error } = await getSupabase()
    .from("outreach_steps")
    .update({ status: "scheduled" })
    .eq("opportunity_id", oppId)
    .eq("status", "planned");
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function setStepDoneAction(stepId: string, done: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!STEP_ID.test(stepId)) return { ok: false, error: "Unknown step." };
  const { error } = await getSupabase()
    .from("outreach_steps")
    .update(done ? { status: "done", done_at: new Date().toISOString() } : { status: "scheduled", done_at: null })
    .eq("id", stepId);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function saveStepAction(stepId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!STEP_ID.test(stepId)) return { ok: false, error: "Unknown step." };
  const { error } = await getSupabase().from("outreach_steps").update({ body: body.slice(0, 3000) }).eq("id", stepId);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------- reps

export async function saveVoiceNoteAction(repId: string, note: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^REP-\d{2}$/.test(repId)) return { ok: false, error: "Unknown rep." };
  const value = note.trim().slice(0, 500) || null;
  const { error } = await getSupabase().from("reps").update({ voice_note: value }).eq("id", repId);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------- demo

const DEMO_SIGNAL = "SIG-0023";

// Hackathon only (/about?admin=1): clears the Finney demo so Generate can run
// live again. Its outreach steps go with the opportunities (on delete cascade).
export async function resetDemoAction(): Promise<{ ok: boolean; message: string }> {
  try {
    const db = getSupabase();
    const { error: delErr, count } = await db
      .from("opportunities")
      .delete({ count: "exact" })
      .eq("signal_id", DEMO_SIGNAL);
    if (delErr) return { ok: false, message: `Could not delete the demo opportunities (${delErr.message}).` };
    const { error: updErr } = await db.from("signals").update({ status: "new" }).eq("id", DEMO_SIGNAL);
    if (updErr) return { ok: false, message: `Opportunities cleared, but the signal status was not reset (${updErr.message}).` };
    revalidateAll();
    return { ok: true, message: `Demo reset: ${count ?? 0} Finney opportunities removed; SIG-0023 is new again.` };
  } catch (e) {
    return { ok: false, message: message(e) };
  }
}
