import Anthropic from "@anthropic-ai/sdk";
import type { Account, Signal } from "./types";

export type Draft = {
  score: number;
  why_now: string;
  email_subject: string;
  email_body: string;
  ai_offline: boolean;
};

export type RepVoice = { name: string; voice_note?: string | null };

const MODEL = "claude-sonnet-5-5";
const TIMEOUT_MS = 12_000;

export const MODULE_CAPABILITY: Record<string, string> = {
  "Irrigation Scheduling": "It builds a watering plan per field from soil-moisture readings and evapotranspiration, so limited water goes where it protects the most yield.",
  "Field-Work Planner": "It turns the forecast and field conditions into planting, spraying and harvest windows per field, so crews go where the ground can carry them.",
  "Yield & Insurance Records": "It keeps field-level yield estimates and the documentation a crop-insurance adjuster asks for, so a claim is ready when you need it.",
};

// ---------------------------------------------------------------- scoring

const DRY_CROPS = ["corn", "sorghum", "wheat", "soy"];

// Deterministic rubric, 0-100. Claude receives it as the baseline and may move
// the final score by at most 10 points with a reason, so acreage and module gap
// always carry their weight.
export function rubricScore(account: Account, signal: Signal, leadWith: string): number {
  const severity = signal.severity === "High" ? 35 : 25;
  const a = account.acres;
  const acreage = a >= 5000 ? 25 : a >= 3000 ? 20 : a >= 1500 ? 13 : a >= 1000 ? 8 : 3;
  const gap = leadWith === signal.target_module ? 20 : 10;
  const crop =
    signal.type === "rain" || account.crops.some((c) => DRY_CROPS.some((d) => c.toLowerCase().startsWith(d))) ? 10 : 0;
  let relationship = account.customer_status === "Customer" ? 5 : 0;
  if (account.last_contact) {
    const days = (Date.parse(signal.week_of) - Date.parse(account.last_contact)) / 86_400_000;
    if (days >= 0 && days <= 30) relationship += 5;
  }
  return Math.min(100, severity + acreage + gap + crop + relationship);
}

const RUBRIC_TEXT = `Score rubric (0-100), already computed for you as baseline_score:
- Signal severity: High 35, Medium 25.
- Acreage: 5,000+ = 25; 3,000-4,999 = 20; 1,500-2,999 = 13; 1,000-1,499 = 8; under 1,000 = 3.
- Module gap: leading with the signal's own module = 20; a secondary module = 10.
- Crop directly affected by this weather = 10.
- Relationship: existing customer = 5; contacted within 30 days = 5 more.
Return score within 10 points of baseline_score. Move it only for a concrete reason in the facts (for example the crop stage makes this week decisive); otherwise return the baseline.`;

// ---------------------------------------------------------------- prompts

export const FIELDSENSE = `FieldSense is farm-operations software sold by ThiboLiSoft to crop growers in the US Plains. Modules: Irrigation Scheduling (soil-moisture and ET watering plans), Field-Work Planner (planting, spraying and harvest windows), Yield & Insurance Records (yield forecasts and crop-insurance documentation).`;

const EMAIL_RULES = `Email rules:
- At most 120 words in the body.
- First line: "Hi <contact first name>," then exactly three short paragraphs separated by blank lines:
  1. The hook: the weather event in this county, in plain farm terms, and why it matters this week.
  2. What the lead module does for this farm specifically (acres, crops).
  3. The ask: 15 minutes this week.
- Then a sign-off line with the rep's first name, unless the rep's voice note says otherwise.
- If customer_status is Customer: name the modules they already own and skip any introduction of FieldSense.
- If customer_status is Prospect: one short sentence introducing FieldSense in paragraph 2; assume no familiarity.
- Plain, specific language. No marketing phrases, no exclamation marks unless the voice note allows them.
- If the rep has a voice note, follow it.
- Use the contact's role and the rep's note on the account where they make the email more specific; never quote the note verbatim.`;

const DRAFT_SYSTEM = `You are a sales assistant for FieldSense. ${FIELDSENSE}

Given one account, one weather signal, the module to lead with and the rep, return JSON with:
- score: integer, see the rubric.
- why_now: one sentence a rep can say on the phone: what happened, why it matters to this farm, this week.
- email_subject: short and specific.
- email_body: the email, per the email rules.

${RUBRIC_TEXT}

${EMAIL_RULES}

Return JSON only.`;

const REWRITE_SYSTEM = `You are a sales assistant for FieldSense. ${FIELDSENSE}

You rewrite an existing outreach email. Keep every fact: the county, the weather event, the acreage, the module, whether they are a customer or prospect, and the 15-minute ask. Do not invent new facts. Apply the requested tone or instruction.

${EMAIL_RULES}

Return JSON with email_subject and email_body only.`;

const TONE_GUIDE: Record<string, string> = {
  Direct: "Direct: lead with the point, cut pleasantries and hedges.",
  Warm: "Warm: friendly and personal, acknowledge the relationship or the season, still brief.",
  Technical: "Technical: add one concrete detail of how the module works (data it uses, what it outputs).",
  Shorter: "Shorter: cut to about 60 words, keep the three-paragraph shape and the ask.",
};

// ---------------------------------------------------------------- helpers

export function firstName(full: string | null | undefined, fallback: string): string {
  const f = (full ?? "").trim().split(/\s+/)[0];
  return f || fallback;
}

export function accountFacts(account: Account) {
  return {
    name: account.name,
    contact_first_name: firstName(account.contact_name, "there"),
    contact_role: account.contact_role ?? null,
    rep_note: account.notes ?? null,
    county: `${account.county}, ${account.state}`,
    crops: account.crops,
    acres: account.acres,
    customer_status: account.customer_status,
    modules_owned: account.modules_owned,
    last_contact: account.last_contact,
  };
}

export function signalFacts(signal: Signal) {
  return {
    type: signal.type,
    severity: signal.severity,
    headline: signal.headline,
    detail: signal.detail,
    week_of: signal.week_of,
  };
}

export async function callJson<T>(system: string, input: unknown, schema: Record<string, unknown>): Promise<T | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
    const call = client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      // Short structured task on a 12 s budget: no thinking between steps, low effort.
      thinking: { type: "between_tools" },
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timer = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
    });
    const response = await Promise.race([call, timer]).finally(() => clearTimeout(timeoutId));
    if (response.stop_reason !== "end_turn") return null;
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    return JSON.parse(text.text) as T;
  } catch (e) {
    console.error("Claude call fell back to rules:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------------------------------------------------------------- draft

// Rules-based result used whenever Claude is unavailable. Never throws.
export function rulesDraft(account: Account, signal: Signal, leadWith: string, rep: RepVoice): Draft {
  const prospect = account.customer_status === "Prospect";
  let score = signal.severity === "High" ? 70 : 55;
  if (account.acres > 3000) score += 15;
  else if (account.acres > 1500) score += 8;
  if (prospect) score += 10;
  score = Math.min(score, 100);

  const crops = account.crops.map((c) => c.toLowerCase()).join(" and ");
  const acres = account.acres.toLocaleString("en-US");
  const contact = firstName(account.contact_name, "there");
  const repFirst = firstName(rep.name, "Your FieldSense rep");
  const intro = prospect
    ? `FieldSense is farm-operations software built for Plains growers, and ${leadWith} is the part that fits this week. `
    : account.modules_owned.length
      ? `You already run ${account.modules_owned.join(" and ")} with us; ${leadWith} adds the piece this week calls for. `
      : `As a FieldSense customer, ${leadWith} is the piece this week calls for. `;

  return {
    score,
    why_now: `${signal.headline}; ${account.name} has ${acres} acres of ${crops} and does not yet use ${leadWith}.`,
    email_subject: `${signal.county} this week: ${leadWith}`,
    email_body: `Hi ${contact},\n\n${signal.headline}. With ${acres} acres of ${crops}, this is the week it shows up in your fields.\n\n${intro}${MODULE_CAPABILITY[leadWith] ?? ""}\n\nCould we take 15 minutes this week to look at it on your acres?\n\n${repFirst}`,
    ai_offline: true,
  };
}

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    why_now: { type: "string" },
    email_subject: { type: "string" },
    email_body: { type: "string" },
  },
  required: ["score", "why_now", "email_subject", "email_body"],
  additionalProperties: false,
};

export async function scoreAndDraft(account: Account, signal: Signal, leadWith: string, rep: RepVoice): Promise<Draft> {
  const baseline = rubricScore(account, signal, leadWith);
  const parsed = await callJson<Omit<Draft, "ai_offline">>(
    DRAFT_SYSTEM,
    {
      account: accountFacts(account),
      signal: signalFacts(signal),
      lead_with: leadWith,
      target_module: signal.target_module,
      baseline_score: baseline,
      rep: { name: rep.name, voice_note: rep.voice_note ?? null },
    },
    DRAFT_SCHEMA,
  );
  if (!parsed || typeof parsed.score !== "number" || !parsed.why_now || !parsed.email_subject || !parsed.email_body) {
    return rulesDraft(account, signal, leadWith, rep);
  }
  // Enforce the ±10 band even if the model drifts.
  const score = Math.max(0, Math.min(100, Math.max(baseline - 10, Math.min(baseline + 10, Math.round(parsed.score)))));
  return {
    score,
    why_now: parsed.why_now.trim(),
    email_subject: parsed.email_subject.trim(),
    email_body: parsed.email_body.trim(),
    ai_offline: false,
  };
}

// ---------------------------------------------------------------- rewrite

export type Rewrite = { email_subject: string; email_body: string; ai_offline: boolean; note?: string };
export type RewriteRequest = { tone?: string; instruction?: string };

const REWRITE_SCHEMA = {
  type: "object",
  properties: { email_subject: { type: "string" }, email_body: { type: "string" } },
  required: ["email_subject", "email_body"],
  additionalProperties: false,
};

function sentences(text: string): string[] {
  return text.match(/[^.?!]+[.?!]+(\s|$)/g)?.map((s) => s.trim()) ?? [text.trim()];
}

// Split into greeting, middle paragraphs, sign-off.
function parts(body: string) {
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const greeting = paras.length > 1 && /,$/.test(paras[0]) && paras[0].length < 60 ? paras.shift()! : "";
  const last = paras[paras.length - 1] ?? "";
  const signoff = paras.length > 1 && last.length < 60 && !/\?/.test(last) ? paras.pop()! : "";
  return { greeting, paras, signoff };
}

function join(greeting: string, paras: string[], signoff: string): string {
  return [greeting, ...paras, signoff].filter(Boolean).join("\n\n");
}

const PLEASANTRY = /\b(hope (you|this|all)|just wanted|reaching out|i know you('| a)re busy|quick note|touch base|thanks for (your|all))\b/i;

// Deterministic variants for when Claude is unavailable. Never throws.
export function rulesRewrite(
  account: Account,
  leadWith: string,
  current: { subject: string; body: string },
  req: RewriteRequest,
): Rewrite {
  const { greeting, paras, signoff } = parts(current.body);
  const base = { email_subject: current.subject, ai_offline: true as const };
  if (req.instruction && !req.tone) {
    return { ...base, email_body: current.body, note: "Claude is offline, so the instruction was not applied. Edit the draft directly." };
  }
  const all = paras.flatMap(sentences);
  const ask = [...all].reverse().find((s) => /15 minutes|fifteen minutes|\?$/.test(s)) ?? "Could we take 15 minutes this week?";
  switch (req.tone) {
    case "Shorter": {
      const firstTwo = all.filter((s) => s !== ask).slice(0, 2).join(" ");
      return { ...base, email_body: join(greeting, [firstTwo, ask], signoff) };
    }
    case "Direct": {
      const kept = paras.map((p) => sentences(p).filter((s) => !PLEASANTRY.test(s)).join(" ")).filter(Boolean);
      return { ...base, email_body: join(greeting, kept, signoff) };
    }
    case "Warm": {
      const when = account.last_contact
        ? new Date(`${account.last_contact}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })
        : null;
      const line = when ? `It was good to talk with you back in ${when}.` : "Thanks for your time this season.";
      return { ...base, email_body: join(greeting, [`${line} ${paras[0] ?? ""}`.trim(), ...paras.slice(1)], signoff) };
    }
    case "Technical": {
      const cap = MODULE_CAPABILITY[leadWith] ?? "";
      const next = [...paras];
      const i = Math.min(1, next.length - 1);
      if (i >= 0) next[i] = `${next[i]} ${cap}`.trim();
      return { ...base, email_body: join(greeting, next, signoff) };
    }
    default:
      return { ...base, email_body: current.body };
  }
}

export async function rewriteEmail(
  account: Account,
  signal: Signal | null,
  leadWith: string,
  rep: RepVoice,
  current: { subject: string; body: string },
  req: RewriteRequest,
): Promise<Rewrite> {
  const parsed = await callJson<{ email_subject: string; email_body: string }>(
    REWRITE_SYSTEM,
    {
      account: accountFacts(account),
      signal: signal ? signalFacts(signal) : null,
      lead_with: leadWith,
      rep: { name: rep.name, voice_note: rep.voice_note ?? null },
      current_draft: current,
      tone: req.tone ? TONE_GUIDE[req.tone] ?? req.tone : null,
      instruction: req.instruction ?? null,
    },
    REWRITE_SCHEMA,
  );
  if (!parsed?.email_subject || !parsed?.email_body) return rulesRewrite(account, leadWith, current, req);
  return { email_subject: parsed.email_subject.trim(), email_body: parsed.email_body.trim(), ai_offline: false };
}
