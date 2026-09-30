"use server";

import { revalidatePath } from "next/cache";
import { rewriteEmail, type RewriteRequest } from "@/lib/claude";
import { RETIRED_WEEK, withDerivedStatus } from "@/lib/data";
import SEED from "@/lib/seed-snapshot.json";
import { buildSequence } from "@/lib/sequence";
import { refreshSignals, type RefreshResult } from "@/lib/signals-refresh";
import { getSupabase } from "@/lib/supabase";
import { SEQUENCE_DAYS, type Account, type Opportunity, type OutreachStep, type Rep, type Response, type Signal, type Stage } from "@/lib/types";
import { getView } from "@/lib/view";

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
  return { opp: o, account: await withDerivedStatus(acc.data as Account), signal: (sig.data as Signal | null) ?? null, rep: (rep.data as Rep | null) ?? null };
}

// VS-12 T19: the manager views rep work but never changes it, and a rep acts
// only on their own records. Returns the refusal, or null to proceed.
async function repGuard(oppId: string): Promise<string | null> {
  const view = await getView();
  if (view.kind === "manager") return "Read-only in manager view.";
  const { data } = await getSupabase().from("opportunities").select("rep_id").eq("id", oppId).maybeSingle();
  if (data && data.rep_id !== view.repId) return "That record belongs to another territory.";
  return null;
}

async function stepGuard(stepId: string): Promise<string | null> {
  const { data } = await getSupabase().from("outreach_steps").select("opportunity_id").eq("id", stepId).maybeSingle();
  if (!data) return (await getView()).kind === "manager" ? "Read-only in manager view." : null;
  return repGuard(String(data.opportunity_id));
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
  const guard = await repGuard(oppId);
  if (guard) return { ok: false, error: guard };
  const { error } = await getSupabase().from("opportunities").update({ promoted }).eq("id", oppId);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------- drafts

export async function saveDraftAction(oppId: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!OPP_ID.test(oppId)) return { ok: false, error: "Unknown opportunity." };
  const guard = await repGuard(oppId);
  if (guard) return { ok: false, error: guard };
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
    const guard = await repGuard(oppId);
    if (guard) return { ok: false, error: guard };
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
    const guard = await repGuard(oppId);
    if (guard) return { ok: false, error: guard };
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
    const guard = await repGuard(oppId);
    if (guard) return { ok: false, error: guard };
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
  const guard = await repGuard(oppId);
  if (guard) return { ok: false, error: guard };
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
export async function buildSequenceAction(oppId: string, tone?: string | null): Promise<SequenceResult> {
  try {
    const guard = await repGuard(oppId);
    if (guard) return { ok: false, error: guard };
    const { opp, account, signal, rep } = await loadOpp(oppId);
    if (opp.stage === "won" || opp.stage === "lost") return { ok: false, error: "This opportunity is closed." };
    const db = getSupabase();
    const { data: existing, error: readErr } = await db.from("outreach_steps").select("*").eq("opportunity_id", oppId);
    if (readErr) return { ok: false, error: `Sequences are not available yet (${readErr.message}).` };
    const byDay = new Map(((existing ?? []) as OutreachStep[]).map((s) => [s.day, s]));
    const finished = (st?: OutreachStep) => st?.status === "done" || st?.status === "skipped";
    if (SEQUENCE_DAYS.every((d) => finished(byDay.get(d)))) return { ok: true, aiOffline: false };

    const toneName = tone && TONES.includes(tone) ? tone : null;
    const draft = await buildSequence(account, signal, opp, { name: rep?.name ?? "Your rep", voice_note: rep?.voice_note ?? null }, toneName);
    for (const step of draft.steps) {
      const prev = byDay.get(step.day);
      if (finished(prev)) continue;
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

const TONES = ["Direct", "Warm", "Technical", "Shorter"];
const DAY_MS = 86_400_000;

// Today in US Central as an ISO date, plus n days.
function centralDate(plusDays = 0): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + plusDays);
  return d.toISOString().slice(0, 10);
}

// Whole days from acceptance to today + n: the "day" of a step added now.
function dayFromAccept(opp: Opportunity, plusDays: number): number {
  const base = Date.parse(opp.pushed_at ?? opp.created_at);
  return Math.max(0, Math.round((Date.parse(`${centralDate(plusDays)}T12:00:00Z`) - base) / DAY_MS));
}

const NEEDS_VS12 = "This needs supabase/migrations/vs12.sql, which has not been run yet.";
// Errors that mean the VS-12 columns or the "skipped" status are not there yet.
const missingColumn = (m: string) => /due_on|responded_at|response|schema cache|status_check|check constraint/i.test(m);

// VS-12 T7: move every unfinished step to today + 0 / 3 / 7 days, in order.
export async function rescheduleAction(oppId: string): Promise<{ ok: boolean; error?: string }> {
  if (!OPP_ID.test(oppId)) return { ok: false, error: "Unknown opportunity." };
  const guard = await repGuard(oppId);
  if (guard) return { ok: false, error: guard };
  const db = getSupabase();
  const { data, error } = await db.from("outreach_steps").select("*").eq("opportunity_id", oppId).order("day");
  if (error) return { ok: false, error: error.message };
  const open = ((data ?? []) as OutreachStep[]).filter((st) => st.status === "planned" || st.status === "scheduled");
  const offsets = [0, 3, 7];
  for (let i = 0; i < open.length; i++) {
    const plus = offsets[i] ?? offsets[offsets.length - 1] + 7 * (i - offsets.length + 1);
    const { error: e } = await db.from("outreach_steps").update({ due_on: centralDate(plus) }).eq("id", open[i].id);
    if (e) return { ok: false, error: missingColumn(e.message) ? NEEDS_VS12 : e.message };
  }
  revalidateAll();
  return { ok: true };
}

async function addStep(opp: Opportunity, plusDays: number, channel: "email" | "call", title: string, body: string) {
  const db = getSupabase();
  const { data } = await db.from("outreach_steps").select("day").eq("opportunity_id", opp.id);
  const used = new Set((data ?? []).map((r) => Number(r.day)));
  let day = dayFromAccept(opp, plusDays);
  while (used.has(day)) day++;
  return db.from("outreach_steps").insert({
    opportunity_id: opp.id,
    day,
    channel,
    title,
    body,
    status: "scheduled",
    ai_offline: false,
    due_on: centralDate(plusDays),
  });
}

// VS-12 T8: the rep logs the customer's response. Interested or Not now skip
// the remaining steps; Not now also adds a check-in email in 30 days.
export async function logResponseAction(oppId: string, response: Response, note: string): Promise<{ ok: boolean; error?: string }> {
  if (!OPP_ID.test(oppId)) return { ok: false, error: "Unknown opportunity." };
  if (!["interested", "not_now", "not_interested"].includes(response)) return { ok: false, error: "Unknown response." };
  const guard = await repGuard(oppId);
  if (guard) return { ok: false, error: guard };
  try {
    const { opp, account } = await loadOpp(oppId);
    const db = getSupabase();
    const { error } = await db
      .from("opportunities")
      .update({ responded_at: new Date().toISOString(), response, response_note: note.trim().slice(0, 200) || null })
      .eq("id", oppId);
    if (error) return { ok: false, error: missingColumn(error.message) ? NEEDS_VS12 : error.message };
    if (response === "interested" || response === "not_now") {
      const { error: e } = await db
        .from("outreach_steps")
        .update({ status: "skipped" })
        .eq("opportunity_id", oppId)
        .in("status", ["planned", "scheduled"]);
      if (e) return { ok: false, error: missingColumn(e.message) ? NEEDS_VS12 : e.message };
    }
    if (response === "not_now") {
      const first = (account.contact_name ?? "").split(" ")[0] || "there";
      const { error: e } = await addStep(
        opp,
        30,
        "email",
        "Check in",
        `Hi ${first},

Checking back in as promised. How did the season finish on your acres? If ${opp.lead_with} is worth a look now, I can show you in 15 minutes.

Thanks`,
      );
      if (e) return { ok: false, error: e.message };
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

// VS-12 T8: after an Interested reply, one Call step dated today + 2.
export async function bookFollowUpAction(oppId: string): Promise<{ ok: boolean; error?: string }> {
  if (!OPP_ID.test(oppId)) return { ok: false, error: "Unknown opportunity." };
  const guard = await repGuard(oppId);
  if (guard) return { ok: false, error: guard };
  try {
    const { opp, account } = await loadOpp(oppId);
    const first = (account.contact_name ?? "").split(" ")[0] || "the contact";
    const { error } = await addStep(
      opp,
      2,
      "call",
      `Follow-up call with ${first}`,
      `${first} replied interested. Confirm a time to walk through ${opp.lead_with} on their fields, and who else should join.`,
    );
    if (error) return { ok: false, error: missingColumn(error.message) ? NEEDS_VS12 : error.message };
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function scheduleAllAction(oppId: string): Promise<{ ok: boolean; error?: string }> {
  if (!OPP_ID.test(oppId)) return { ok: false, error: "Unknown opportunity." };
  const guard = await repGuard(oppId);
  if (guard) return { ok: false, error: guard };
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
  const guard = await stepGuard(stepId);
  if (guard) return { ok: false, error: guard };
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
  const guard = await stepGuard(stepId);
  if (guard) return { ok: false, error: guard };
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

// VS-10: Reset demo restores the whole seed state, not just Finney. It is
// idempotent: running it twice leaves the same rows.
//  - signals not in the seed are deleted; where the database does not allow
//    deleting signals, they are retired instead (week_of moved to RETIRED_WEEK,
//    which the app ignores everywhere);
//  - opportunities not in the seed, and every outreach step, are deleted;
//  - seed opportunities get their seed stage, dates, email and promoted flag
//    back; seed signals their status; reps their voice note.
async function chunked<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

export async function resetDemoAction(): Promise<{ ok: boolean; message: string }> {
  try {
    const db = getSupabase();
    const seedOppIds = new Set(SEED.opportunities.map((o) => o.id));
    const seedSignalIds = new Set(SEED.signals.map((s) => s.id));
    const notes: string[] = [];

    // 1. Outreach steps: all of them.
    const steps = await db.from("outreach_steps").delete({ count: "exact" }).not("id", "is", null);
    if (steps.error) notes.push(`steps not cleared (${steps.error.message})`);

    // 2. Opportunities not in the seed (this also covers every generated lead).
    const { data: allOpps, error: oppReadErr } = await db.from("opportunities").select("id");
    if (oppReadErr) return { ok: false, message: `Could not read opportunities (${oppReadErr.message}).` };
    const extraOpps = (allOpps ?? []).map((o) => o.id as string).filter((id) => !seedOppIds.has(id));
    if (extraOpps.length) {
      const { error } = await db.from("opportunities").delete().in("id", extraOpps);
      if (error) return { ok: false, message: `Could not delete generated opportunities (${error.message}).` };
    }

    // 3. Signals not in the seed: delete, or retire where delete is not granted.
    const { data: allSignals, error: sigReadErr } = await db.from("signals").select("id,week_of");
    if (sigReadErr) return { ok: false, message: `Could not read signals (${sigReadErr.message}).` };
    const extraSignals = (allSignals ?? []).filter((s) => !seedSignalIds.has(s.id as string));
    let retired = 0;
    if (extraSignals.length) {
      const ids = extraSignals.map((s) => s.id as string);
      await db.from("opportunities").delete().in("signal_id", ids);
      const del = await db.from("signals").delete({ count: "exact" }).in("id", ids);
      if (del.error || (del.count ?? 0) < ids.length) {
        const left = extraSignals.filter((s) => s.week_of !== RETIRED_WEEK).map((s) => s.id as string);
        if (left.length) {
          const { error } = await db.from("signals").update({ week_of: RETIRED_WEEK, status: "processed" }).in("id", left);
          if (error) return { ok: false, message: `Could not remove the extra signals (${error.message}).` };
        }
        retired = ids.length;
      }
    }

    // 4. Seed rows back to their seed values.
    let restoreErrors = 0;
    await chunked(SEED.opportunities, 10, async (o) => {
      const { error } = await db
        .from("opportunities")
        .update({
          stage: o.stage,
          pushed_at: o.pushed_at,
          sent_at: o.sent_at,
          email_subject: o.email_subject,
          email_body: o.email_body,
          why_now: o.why_now,
          promoted: false,
          email_history: [],
        })
        .eq("id", o.id);
      if (error) restoreErrors++;
    });
    // VS-12 T8: clear logged replies (a no-op, with no error surfaced, before vs12.sql).
    await db.from("opportunities").update({ responded_at: null, response: null, response_note: null }).not("responded_at", "is", null);
    await chunked(SEED.signals, 10, async (s) => {
      const { error } = await db.from("signals").update({ status: s.status }).eq("id", s.id);
      if (error) restoreErrors++;
    });
    await chunked(SEED.reps, 10, async (r) => {
      const { error } = await db.from("reps").update({ voice_note: r.voice_note }).eq("id", r.id);
      if (error) restoreErrors++;
    });

    revalidateAll();
    const parts = [
      `${extraOpps.length} generated opportunit${extraOpps.length === 1 ? "y" : "ies"} removed`,
      `${steps.count ?? 0} outreach step${steps.count === 1 ? "" : "s"} cleared`,
      extraSignals.length
        ? retired
          ? `${retired} extra signal${retired === 1 ? "" : "s"} retired (fallback path: the database refused the delete)`
          : `${extraSignals.length} extra signal${extraSignals.length === 1 ? "" : "s"} deleted (delete path)`
        : "no extra signals to delete",
      `${SEED.opportunities.length} seed opportunities and ${SEED.signals.length} signals restored`,
    ];
    if (restoreErrors) parts.push(`${restoreErrors} rows could not be restored`);
    if (notes.length) parts.push(...notes);
    return { ok: restoreErrors === 0, message: `Demo reset: ${parts.join("; ")}.` };
  } catch (e) {
    return { ok: false, message: message(e) };
  }
}
