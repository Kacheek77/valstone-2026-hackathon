-- Signal Desk schema (VS-7). Run this first, then seed.sql, in the Supabase SQL editor.
-- (seed-extras.sql is now a no-op: the seed carries every rep's voice note.)
-- Matches the schema in "From LC Claude/data/README-DATA.md", plus the columns the
-- advisor kept in VS-4a: signals.drought_level, settings.weekly_history and the
-- unique (signal_id, account_id) on opportunities. Drops and recreates everything.
--
-- HACKATHON ONLY: row level security is on, but the anon role may SELECT,
-- INSERT and UPDATE every table. Anyone holding the anon key can change the
-- data. A real deployment needs authenticated users and per-rep policies.

drop table if exists public.dry_run_entries cascade;   -- VS-3 leftover
drop table if exists public.outreach_steps cascade;
drop table if exists public.opportunities cascade;
drop table if exists public.signals cascade;
drop table if exists public.accounts cascade;
drop table if exists public.reps cascade;
drop table if exists public.settings cascade;

-- VS-4 used enums; VS-4a uses text with check constraints.
drop type if exists public.signal_type cascade;
drop type if exists public.signal_severity cascade;
drop type if exists public.signal_status cascade;
drop type if exists public.opportunity_stage cascade;

create table public.reps (
  id text primary key,                               -- REP-01 .. REP-06, MGR-01
  name text not null,
  territory_name text not null,
  counties text[] not null default '{}',             -- "Finney County, KS"
  quota_quarterly integer not null default 0,
  is_manager boolean not null default false,
  voice_note text                                    -- VS-5: rep's writing voice for drafts
);

create table public.accounts (
  id text primary key,                               -- ACC-001
  name text not null,
  county text not null,                              -- "Finney County"
  state text not null,
  lat double precision not null,
  lng double precision not null,
  crops text[] not null default '{}',
  acres integer not null,
  modules_owned text[] not null default '{}',
  customer_status text not null,                     -- Customer | Prospect
  contact_name text,
  contact_email text,
  contact_role text,                                 -- VS-7
  notes text,                                        -- VS-7: the rep's note on the account
  last_contact date,
  rep_id text references public.reps (id)
);

create table public.signals (
  id text primary key,                               -- SIG-0023
  week_of date not null,
  county text not null,
  state text not null,
  lat double precision not null,
  lng double precision not null,
  type text not null check (type in ('drought', 'rain', 'heat')),
  severity text not null check (severity in ('High', 'Medium')),
  headline text not null,
  detail text not null,
  source text not null,
  target_module text not null,
  status text not null default 'new' check (status in ('new', 'processed')),
  rep_id text references public.reps (id),
  drought_level smallint                             -- USDM level after the change; null in the seed,
                                                     -- where the app reads it from the headline
);

create table public.opportunities (
  id text primary key,                               -- OPP-0042
  signal_id text references public.signals (id) on delete cascade,  -- null = list-prospected
  account_id text not null references public.accounts (id) on delete cascade,
  rep_id text references public.reps (id),
  score integer not null,
  lead_with text not null,
  why_now text not null,
  email_subject text not null,
  email_body text not null,
  amount integer not null,
  stage text not null default 'draft' check (stage in ('draft', 'pushed', 'sent', 'won', 'lost')),
  ai_offline boolean not null default false,
  is_signal_driven boolean not null default true,
  is_off_territory boolean not null default false,
  sf_opportunity_id text,
  sf_error text,
  created_at timestamptz not null default now(),
  pushed_at timestamptz,
  sent_at timestamptz,
  email_history jsonb not null default '[]',         -- VS-5: earlier drafts, oldest first
  promoted boolean not null default false,           -- VS-5: below-threshold row promoted to a lead
  unique (signal_id, account_id)                     -- makes Generate idempotent
);

-- VS-7: outreach sequence. Day 0 is the opportunity's own email; these rows
-- are the follow-up touches (Day 3 call, Day 7 email, Day 14 text).
create table public.outreach_steps (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null references public.opportunities (id) on delete cascade,
  day integer not null,
  channel text not null check (channel in ('email', 'call', 'text')),
  title text not null,
  body text not null,
  status text not null default 'planned' check (status in ('planned', 'scheduled', 'done')),
  ai_offline boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (opportunity_id, day)
);

create table public.settings (
  id integer primary key default 1 check (id = 1),
  price_list jsonb not null,
  weekly_history jsonb not null default '{}'         -- kept per VS-4a; the seed leaves it empty
);

-- Row level security: on everywhere, open to anon (hackathon only, see top).
alter table public.reps enable row level security;
alter table public.accounts enable row level security;
alter table public.signals enable row level security;
alter table public.opportunities enable row level security;
alter table public.settings enable row level security;
alter table public.outreach_steps enable row level security;

create policy "anon select reps" on public.reps for select to anon using (true);
create policy "anon insert reps" on public.reps for insert to anon with check (true);
create policy "anon update reps" on public.reps for update to anon using (true) with check (true);

create policy "anon select accounts" on public.accounts for select to anon using (true);
create policy "anon insert accounts" on public.accounts for insert to anon with check (true);
create policy "anon update accounts" on public.accounts for update to anon using (true) with check (true);

create policy "anon select signals" on public.signals for select to anon using (true);
create policy "anon insert signals" on public.signals for insert to anon with check (true);
create policy "anon update signals" on public.signals for update to anon using (true) with check (true);

create policy "anon select opportunities" on public.opportunities for select to anon using (true);
create policy "anon insert opportunities" on public.opportunities for insert to anon with check (true);
create policy "anon update opportunities" on public.opportunities for update to anon using (true) with check (true);

create policy "anon select outreach_steps" on public.outreach_steps for select to anon using (true);
create policy "anon insert outreach_steps" on public.outreach_steps for insert to anon with check (true);
create policy "anon update outreach_steps" on public.outreach_steps for update to anon using (true) with check (true);
create policy "anon delete outreach_steps" on public.outreach_steps for delete to anon using (true);

create policy "anon select settings" on public.settings for select to anon using (true);
create policy "anon insert settings" on public.settings for insert to anon with check (true);
create policy "anon update settings" on public.settings for update to anon using (true) with check (true);

-- Table privileges for the API role. RLS policies only filter rows; without
-- these grants this project answers "permission denied for table".
grant usage on schema public to anon;
grant select, insert, update on public.reps, public.accounts, public.signals, public.opportunities, public.settings to anon;

-- HACKATHON ONLY: lets the /about?admin=1 "Reset demo" button delete the
-- Finney demo opportunities. Remove before any real use.
grant delete on public.opportunities to anon;
grant select, insert, update, delete on public.outreach_steps to anon;
create policy "anon delete opportunities" on public.opportunities for delete to anon using (true);
