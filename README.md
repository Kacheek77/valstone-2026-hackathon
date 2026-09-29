**Live: https://valstone-2026-hackathon.vercel.app**

# Signal Desk

Signal Desk turns each week's county weather into ready-to-send sales opportunities for FieldSense, a fictional farm-software product sold by ThiboLiSoft across the Plains states. When a county's drought worsens, heavy rain closes field days, or heat hits during grain fill, it finds the affected accounts by crop and by the FieldSense module they don't yet own, and Claude scores each one and writes the why-now line and the email. One click pushes the Opportunity and a follow-up Task to Salesforce, and managers see each rep's performance against the opportunity the weather actually created.

Built for the Valstone Fall Summit 2026 Hackathon, Problem 1 (Sales), on Next.js, Supabase and the Claude API, deployed on Vercel.

## Against the brief

| The CEO asked for | Signal Desk does | Where to see it |
|---|---|---|
| More opportunities in the pipeline | Every weekly weather change is matched against the whole account base, including prospects no rep was working, and turned into scored leads | Dashboard → a signal → **Generate leads**; Pipeline |
| Faster deals | Outreach lands in the week the grower feels the problem, with the reason stated in their terms: county, event, acres, module | Signal detail "Why now"; the drafted email on each opportunity |
| Administrative work that disappears | The Opportunity, Task and email are drafted for the rep; tone pills and a one-line instruction rewrite the email in the rep's own voice; one click pushes to the CRM | Opportunity page: **Push to CRM**, tone pills, **Copy email** |
| (Management) | Capture rate against the value the weather created, time to act, off-territory and list-prospected work, per rep | Team view (Enter as manager) |
| Proof it worked | Results shows what was won against the expected value the weather created, per week, per rep and for the team | Results tab |

## What is real and what is seeded

**Real**
- Claude (`claude-sonnet-5-5`) scores every matched account from an explicit rubric, writes the why-now line and a three-paragraph email that branches on customer or prospect, and rewrites drafts on request in the rep's voice. If Claude is unavailable, a rules-based score and template stand in, marked "AI offline".
- Matching is deterministic: accounts in the signal's county (for drought, the whole territory), with a relevant crop, that don't own the module.
- **Refresh signals** calls the US Drought Monitor county data service live and adds a signal only when a territory county's drought category has risen.
- Amounts come from one formula: module rate per acre × acres + $2,500 setup, rounded to $100.
- **Push to CRM** writes an Opportunity and a follow-up Task to a Salesforce Developer Edition org through the client-credentials OAuth flow when `SF_LOGIN_URL`, `SF_CLIENT_ID` and `SF_CLIENT_SECRET` are set. If a connected org rejects the push or takes more than 8 seconds, the push is queued and can be retried.

**Demo mode (the live site today)**
- No Salesforce org is connected, so **Push to CRM** runs in demo mode. The opportunity moves to Pushed with a `DEMO-` record id, and **Open in Salesforce (demo)** opens a mock of the Opportunity and Task the real push would create, labelled as a demo on the page.

**Seeded**
- The 50 accounts, their contacts and the six reps are synthetic, placed in 18 real Plains counties.
- The 23 signals across five weeks and the 42 existing opportunities are seeded history from a generated batch, checked against the late-September 2026 drought picture. Sparklines and time-to-act are computed from that history.

## Demo flags

- `/dashboard?demo=1`: **Refresh signals** inserts one canned signal (Seward County, KS, D3 → D4), so the refresh flow can be shown on any day.
- `/about?admin=1`: **Reset demo** deletes the opportunities on the Finney signal (SIG-0023) and sets it back to new, so **Generate leads** can run live again.

## Run locally

1. `npm install`
2. Create `.env.local` with `SUPABASE_URL` and `SUPABASE_ANON_KEY`, plus optionally `ANTHROPIC_API_KEY` and the three `SF_*` variables. Everything optional has a fallback.
3. In the Supabase SQL editor run `supabase/schema.sql`, then `supabase/seed.sql`, then `supabase/seed-extras.sql`.
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
| Amount | Estimated first-year value: module rate per acre × the account's acres, plus setup. Becomes the Salesforce Opportunity Amount. |
| Stage | Draft (generated, not yet in CRM) → Pushed (Opportunity and Task created in Salesforce, or queued) → Sent (rep sent the email) → Won or Lost. |
