import Anthropic from "@anthropic-ai/sdk";
import type { Account, Signal } from "./types";

export type Draft = {
  score: number;
  why_now: string;
  email_subject: string;
  email_body: string;
  ai_offline: boolean;
};

const MODEL = "claude-sonnet-5-5";
const TIMEOUT_MS = 12_000;

const SYSTEM = `You are a sales assistant for FieldSense, farm-operations software sold by ThiboLiSoft to crop growers in the US Plains. FieldSense has three modules: Irrigation Scheduling (soil-moisture and ET watering plans), Field-Work Planner (planting, spraying and harvest windows), and Yield & Insurance Records (yield forecasts and crop-insurance documentation).

Given one account, one weather signal and the module to lead with, return:
- score: 0-100, how likely this account is to engage this week. Weigh acreage, crop fit, whether they are a prospect or customer, and signal severity.
- why_now: one sentence a rep can say on the phone: what happened, why it matters to this farm, this week.
- email_subject: short and specific.
- email_body: at most 120 words. Open with the contact's first name. Reference the county and the weather event. Write in plain, specific farm terms, no marketing language. End by asking for 15 minutes this week. Sign off as the rep's first name.

Return JSON only.`;

const SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    why_now: { type: "string" },
    email_subject: { type: "string" },
    email_body: { type: "string" },
  },
  required: ["score", "why_now", "email_subject", "email_body"],
  additionalProperties: false,
} as const;

function firstName(full: string | null | undefined, fallback: string): string {
  const f = (full ?? "").trim().split(/\s+/)[0];
  return f || fallback;
}

// Rules-based result used whenever Claude is unavailable. Never throws.
export function rulesDraft(
  account: Account,
  signal: Signal,
  leadWith: string,
  repName: string,
): Draft {
  const prospect = account.modules_owned.length === 0;
  let score = signal.severity === "High" ? 70 : 55;
  if (account.acres > 3000) score += 15;
  else if (account.acres > 1500) score += 8;
  if (prospect) score += 10;
  score = Math.min(score, 100);

  const crops = account.crops.map((c) => c.toLowerCase()).join(" and ");
  const acres = account.acres.toLocaleString("en-US");
  const contact = firstName(account.contact_name, "there");
  const rep = firstName(repName, "Your FieldSense rep");

  return {
    score,
    why_now: `${signal.headline}; ${account.name} has ${acres} acres of ${crops} and does not yet use ${leadWith}.`,
    email_subject: `${signal.county} County this week: ${leadWith}`,
    email_body: `${contact},\n\n${signal.headline}. With ${acres} acres of ${crops}, this is the week it shows up in your fields.\n\n${leadWith} is built for exactly this. It turns the conditions into a field-by-field plan so the decisions you are making now are backed by data.\n\nCould we take 15 minutes this week to look at it on your acres?\n\n${rep}`,
    ai_offline: true,
  };
}

export async function scoreAndDraft(
  account: Account,
  signal: Signal,
  leadWith: string,
  repName: string,
): Promise<Draft> {
  const fallback = () => rulesDraft(account, signal, leadWith, repName);
  if (!process.env.ANTHROPIC_API_KEY) return fallback();

  try {
    const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
    const input = {
      account: {
        name: account.name,
        contact_name: account.contact_name,
        county: `${account.county}, ${account.state}`,
        crops: account.crops,
        acres: account.acres,
        modules_owned: account.modules_owned,
        prospect: account.modules_owned.length === 0,
        last_contact: account.last_contact,
      },
      signal: {
        type: signal.type,
        severity: signal.severity,
        headline: signal.headline,
        detail: signal.detail,
        week_of: signal.week_of,
      },
      lead_with: leadWith,
      rep_name: repName,
    };

    const call = client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      // Short structured task on a 12 s budget: no thinking between steps,
      // low effort.
      thinking: { type: "between_tools" },
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timer = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
    });
    const response = await Promise.race([call, timer]).finally(() =>
      clearTimeout(timeoutId),
    );

    if (response.stop_reason !== "end_turn") return fallback();
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return fallback();

    const parsed = JSON.parse(text.text) as Omit<Draft, "ai_offline">;
    if (
      typeof parsed.score !== "number" ||
      !parsed.why_now ||
      !parsed.email_subject ||
      !parsed.email_body
    ) {
      return fallback();
    }
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      why_now: parsed.why_now.trim(),
      email_subject: parsed.email_subject.trim(),
      email_body: parsed.email_body.trim(),
      ai_offline: false,
    };
  } catch (e) {
    console.error("scoreAndDraft fell back to rules:", e instanceof Error ? e.message : e);
    return fallback();
  }
}
