import { callJson } from "./claude";
import { TRY_MAX_INPUT, type TryChip, type TryOutput } from "./tryChips";

// VS-13 TRY: Signal Desk's pattern applied to any B2B business, in one Claude
// call. Chips answer from fixtures (lib/try-fixtures.json, built with this same
// function); free text and "Regenerate live" call it directly.

const SYSTEM = `You explain Signal Desk by applying it to a visitor's business. Signal Desk is a sales tool: it watches a public data feed for events that change what a company's customers need, matches the customer and prospect accounts affected by each change, scores each account 0-100 for how likely it is to engage this week, and writes a one-sentence why-now line and an outreach email for the rep. In the original, the seller is farm software and the events are weekly drought, rain and heat changes by county.

Given the seller (a company name and what it sells, or a free-text description), return JSON:
- business: one plain sentence naming the seller and what it sells to whom.
- signals: exactly three example signals for this business. Each: event (a specific, observable change, e.g. "USDA declares a drought disaster in a county"), source (a real public source a system could read, e.g. "USDA Farm Service Agency disaster designations"), cadence (how often it changes, e.g. "weekly").
- example: one worked lead. account: a realistic FICTIONAL customer (name, location as "City, ST", profile: one line of size and what they do). signal: which of the three events hit this account. score: integer 55-95. why_now: one sentence a rep can say on the phone. lead_with: the seller's product or module to open with. email_subject: short and specific. email_body: at most 90 words, starting "Hi <first name>," with a fictional contact, ending with a 15-minute ask and the rep's first name.
- needs: one sentence starting "What Signal Desk would need:" naming the customer list and one specific public data feed.

Rules: customer names, contacts and places in the example are fictional; never name a real company, person or brand as a customer. Invent a distinctive account name that fits the industry and place; avoid stock words such as Ridgeline, Prairie, Summit, Pinnacle or Apex. The seller may be named. Plain, specific language; no hype, no exclamation marks. This is an illustrative example. If the input is not a business description, still answer for the closest plausible business.
Return JSON only.`;

const SCHEMA = {
  type: "object",
  properties: {
    business: { type: "string" },
    signals: {
      type: "array",
      items: {
        type: "object",
        properties: { event: { type: "string" }, source: { type: "string" }, cadence: { type: "string" } },
        required: ["event", "source", "cadence"],
        additionalProperties: false,
      },
    },
    example: {
      type: "object",
      properties: {
        account: {
          type: "object",
          properties: { name: { type: "string" }, location: { type: "string" }, profile: { type: "string" } },
          required: ["name", "location", "profile"],
          additionalProperties: false,
        },
        signal: { type: "string" },
        score: { type: "integer" },
        why_now: { type: "string" },
        lead_with: { type: "string" },
        email_subject: { type: "string" },
        email_body: { type: "string" },
      },
      required: ["account", "signal", "score", "why_now", "lead_with", "email_subject", "email_body"],
      additionalProperties: false,
    },
    needs: { type: "string" },
  },
  required: ["business", "signals", "example", "needs"],
  additionalProperties: false,
};

function valid(o: TryOutput | null): o is TryOutput {
  return !!o && Array.isArray(o.signals) && o.signals.length >= 3 && !!o.example?.email_body && !!o.example?.account?.name;
}

export async function generateTry(input: { chip?: TryChip; text?: string }): Promise<TryOutput | null> {
  const seller = input.chip
    ? { company: input.chip.name, sells: input.chip.sells, typical_buying_triggers: input.chip.triggers }
    : { description: (input.text ?? "").slice(0, TRY_MAX_INPUT) };
  const out = await callJson<TryOutput>(SYSTEM, { seller }, SCHEMA, { timeoutMs: 15_000, maxTokens: 1800 });
  if (!valid(out)) return null;
  out.signals = out.signals.slice(0, 3);
  out.example.score = Math.max(0, Math.min(100, Math.round(out.example.score)));
  return out;
}
