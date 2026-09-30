**Live: https://valstone-2026-hackathon.vercel.app**

# Signal Desk

Signal Desk turns each week's county weather into scored, ready-to-work sales leads for FieldSense, a fictional farm-software product sold by ThiboLiSoft across the Plains states. When a county's drought worsens, heavy rain closes field days, or heat hits during grain fill, it finds the affected accounts by crop and by the FieldSense module they don't yet own, and Claude scores each one and writes the why-now line and the email. The rep accepts a lead, runs a four-touch outreach sequence from a task list, and managers see each rep's performance against the opportunity the weather actually created.

Built for the Valstone Fall Summit 2026 Hackathon, Problem 1 (Sales), on Next.js, Supabase and the Claude API, deployed on Vercel.

## Against the brief

| The CEO asked for | Signal Desk does | Where to see it |
|---|---|---|
| More opportunities in the pipeline | Every weekly weather change is matched against the whole account base, including prospects no rep was working, and turned into scored leads | Dashboard → open a signal (scoring starts on arrival); Pipeline |
| Faster deals | Outreach lands in the week the grower feels the problem, with the reason stated in their terms: county, event, acres, module | Signal detail "Why now"; the drafted email on each opportunity |
| Administrative work that disappears | The opportunity, the email and a 14-day outreach sequence are drafted for the rep; tone pills and a one-line instruction rewrite in the rep's own voice; scheduled steps land on a task list | Opportunity page: **Accept lead**, tone pills, **Open sequence**; dashboard **My tasks** |
| (Management) | Capture rate against the value the weather created, time to act, off-territory and list-prospected work, per rep | Team view (Enter as manager) |
| Proof it worked | Results shows what was won against the expected value the weather created, per week, per rep and for the team | Results tab |

## What is real and what is seeded

**Real**
- Claude scores every matched account and writes the why-now line and the email as soon as the signal page opens (three at a time, rows filling in live). If Claude is unreachable, a rules-based score and a template stand in, marked "AI offline".
- Matching is real logic: accounts in the affected county (for drought, the whole territory), with a relevant crop, that do not yet own the module.
- Drought signals are live: Refresh signals calls the US Drought Monitor's county data service and adds a signal only when a county's drought category has risen.
- Amounts come from one formula: module rate per acre × acres + $2,500 setup, rounded to $100.
- Tone pills and "Tell Claude what to change" rewrite a draft live, in the rep's own voice note; every earlier version is kept so the original can be restored.
- Accept lead, the outreach sequence and the task list are the working pipeline; nothing leaves the app.

**Seeded or stand-in**
- All 50 accounts, their contacts and the six reps are synthetic, placed in real Plains counties. A real deployment would read the company's CRM account base.
- Rain and heat signals are seeded. They are written in the form NOAA county forecasts and observations take (rain totals over 4–7 days, consecutive days above 95–98 °F, hail warnings), but Refresh signals does not yet call NOAA; that feed is the next integration. Drought is the only signal type refreshed live.
- The 39 signals across 13 weeks come from a generated batch checked against the real late-September 2026 drought picture.
- The existing opportunities, their stages and accept times are seeded history; the sparklines, time-to-act and Results figures are computed from them.

Standalone for the hackathon. ThiboLiSoft runs Salesforce; syncing accounts in and opportunities/tasks out is the first production step.

## Demo flags

- `/dashboard?demo=1`: **Refresh signals** inserts one canned signal (Seward County, KS, D3 → D4), so the refresh flow can be shown on any day.
- `/about?admin=1`: **Reset demo** restores all seed data and removes generated leads, sequences and refreshed signals. Finney (SIG-0023) goes back to new, so opening it scores its accounts live again.

## Run locally

1. `npm install`
2. Create `.env.local` with `SUPABASE_URL` and `SUPABASE_ANON_KEY`, plus optionally `ANTHROPIC_API_KEY`. Without it, scoring, drafting and sequences fall back to rules and templates.
3. In the Supabase SQL editor run `supabase/schema.sql`, then `supabase/seed.sql`. (`supabase/migrations/vs7.sql` is the additive version of the VS-7 schema changes, for a database already on VS-6.)
4. `npm run dev` and open http://localhost:3000

The schema opens every table to the anon key for the hackathon, including delete on opportunities for the demo reset. A real deployment needs authenticated users and per-rep policies.

## The ten terms

| Term | Meaning |
|---|---|
| Signal | One weather event in one county in one week that changes what a grower needs. The unit everything else hangs off. |
| D0 – D4 | US Drought Monitor severity, published every Thursday by county. D0 abnormally dry, D1 moderate, D2 severe, D3 extreme, D4 exceptional. A change of level is the signal, not the level itself. |
| Severity | How urgent the signal is: High or Medium. Set by rule (a two-step drought jump, heat over 98 °F for 3+ days, or 3+ inches of rain in 5 days is High). |
| Territory | The counties a sales rep owns. The dashboard shows only that rep's accounts and signals; the map shades it. |
| Account | A farm, co-op or irrigation district: customer or prospect, with county, crops, acres and the FieldSense modules it already owns. |
| Lead with | The one FieldSense module to open the conversation with, chosen from the signal type and the modules the account does not yet own. |
| Score | 0–100 likelihood this account will engage this week, produced by Claude from acreage, crop, module gap and signal severity. Sorts the list; does not set the amount. |
| Why now | One sentence, written per account, that a rep can say on the phone: what happened, why it matters to this farm, this week. |
| Amount | Estimated first-year value: module rate per acre × the account's acres, plus setup. The opportunity's value in the pipeline. |
| Stage | Draft (generated, not yet accepted) → Accepted (the rep took the lead into their pipeline; the outreach sequence runs from here) → Sent (rep sent the email) → Won or Lost. |
