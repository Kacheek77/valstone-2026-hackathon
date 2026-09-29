# Signal Desk

Live: https://valstone-2026-hackathon.vercel.app

Weather-triggered lead generation for FieldSense (a fictional ThiboLiSoft product), built for the Valstone Fall Summit 2026 Hackathon, Problem 1 (Sales). County weather comes in, affected accounts are matched, Claude scores each one and drafts the outreach.

This is a stub; the full README (feature-to-brief mapping, real vs. seeded, terms) lands in VS-5.

## Run locally

1. `npm install`
2. Create `.env.local` with `SUPABASE_URL`, `SUPABASE_ANON_KEY` and, optionally, `ANTHROPIC_API_KEY` (without it, scoring falls back to rules).
3. Run `supabase/schema.sql`, then `supabase/seed.sql`, in the Supabase SQL editor.
4. `npm run dev` and open http://localhost:3000

Add `?demo=1` to the dashboard URL to make Refresh signals insert a canned signal.
