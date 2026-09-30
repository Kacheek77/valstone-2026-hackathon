import { accountFacts, callJson, FIELDSENSE, firstName, MODULE_CAPABILITY, TONE_GUIDE, type RepVoice } from "./claude";
import type { Account, Opportunity, Signal, StepChannel } from "./types";

export type StepDraft = { day: number; channel: StepChannel; title: string; body: string };
export type SequenceDraft = { steps: StepDraft[]; ai_offline: boolean };

const CHANNELS: Record<number, StepChannel> = { 3: "call", 7: "email", 14: "text" };

const SYSTEM = `You are a sales assistant for FieldSense. ${FIELDSENSE}

A rep has sent (or is about to send) an opening email to a farm after a weather event. Write the three follow-up touches of a 14-day outreach sequence:
- day3_call: a short phone script for Day 3 (what to open with, one question to ask, the 15-minute ask). Plain spoken language, 60-100 words.
- day7_email: a follow-up email for Day 7, at most 80 words, starting "Hi <contact first name>," that adds one new, concrete reason tied to the weather or the crop stage, and ends with the ask. Include a subject line in day7_subject.
- day14_text: a text message for Day 14, at most 40 words, friendly and brief, from the rep by first name.
Rules: keep every fact consistent with the opening email (county, event, acres, module). If customer_status is Customer, refer to the modules they already own and skip introductions; if Prospect, assume no familiarity with FieldSense. Follow the rep's voice note when present. Use the contact's role and the rep's note on the account where they help; never quote the note verbatim. No exclamation marks unless the voice note allows them.
When a tone is given, apply it to all three touches so the rep's voice is consistent. The tone's rules override the lengths above, within these channel limits: day3_call is talking points (3 to 5 lines, each starting "- "); day7_email follows the tone's word range; day14_text is at most 300 characters.
Return JSON only.`;

const SCHEMA = {
  type: "object",
  properties: {
    day3_call: { type: "string" },
    day7_subject: { type: "string" },
    day7_email: { type: "string" },
    day14_text: { type: "string" },
  },
  required: ["day3_call", "day7_subject", "day7_email", "day14_text"],
  additionalProperties: false,
};

// Template steps when Claude is unavailable, marked AI offline. Never throws.
export function templateSequence(account: Account, signal: Signal | null, opp: Opportunity, rep: RepVoice): SequenceDraft {
  const contact = firstName(account.contact_name, "there");
  const me = firstName(rep.name, "your FieldSense rep");
  const place = signal ? signal.county : account.county;
  const event = signal ? signal.headline : `this season in ${account.county}`;
  const cap = MODULE_CAPABILITY[opp.lead_with] ?? "";
  return {
    ai_offline: true,
    steps: [
      {
        day: 3,
        channel: "call",
        title: `Call ${contact}: follow up on the ${place} email`,
        body: `Hi ${contact}, it's ${me} with FieldSense. I sent a note on Monday about ${event}. With ${account.acres.toLocaleString("en-US")} acres, how are you handling it this week? ${opp.lead_with} is built for exactly this. Could we find 15 minutes this week to look at it on your fields?`,
      },
      {
        day: 7,
        channel: "email",
        title: `Follow-up: ${place} and ${opp.lead_with}`,
        body: `Hi ${contact},\n\nFollowing up on last week's note about ${event}. ${cap}\n\nWould 15 minutes this week work?\n\n${me}`,
      },
      {
        day: 14,
        channel: "text",
        title: "Text: last check-in",
        body: `Hi ${contact}, ${me} from FieldSense. Still happy to show you ${opp.lead_with} on your acres. 15 minutes this week?`,
      },
    ],
  };
}

// Keep a text message under the 300-character limit, cutting at a sentence end.
function textLimit(t: string): string {
  if (t.length <= 300) return t;
  const cut = t.slice(0, 300);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "));
  return end > 100 ? cut.slice(0, end + 1) : `${cut.slice(0, 297).trimEnd()}...`;
}

export async function buildSequence(
  account: Account,
  signal: Signal | null,
  opp: Opportunity,
  rep: RepVoice,
  tone?: string | null,
): Promise<SequenceDraft> {
  const parsed = await callJson<{ day3_call: string; day7_subject: string; day7_email: string; day14_text: string }>(
    SYSTEM,
    {
      account: accountFacts(account),
      signal: signal ? { headline: signal.headline, detail: signal.detail, week_of: signal.week_of, type: signal.type } : null,
      lead_with: opp.lead_with,
      opening_email: { subject: opp.email_subject, body: opp.email_body },
      rep: { name: rep.name, voice_note: rep.voice_note ?? null },
      tone: tone ? TONE_GUIDE[tone] ?? tone : null,
    },
    SCHEMA,
  );
  if (!parsed?.day3_call || !parsed.day7_email || !parsed.day14_text) return templateSequence(account, signal, opp, rep);
  const contact = firstName(account.contact_name, "there");
  return {
    ai_offline: false,
    steps: [
      { day: 3, channel: CHANNELS[3], title: `Call ${contact}`, body: parsed.day3_call.trim() },
      { day: 7, channel: CHANNELS[7], title: parsed.day7_subject.trim() || "Follow-up email", body: parsed.day7_email.trim() },
      { day: 14, channel: CHANNELS[14], title: "Text: last check-in", body: textLimit(parsed.day14_text.trim()) },
    ],
  };
}
