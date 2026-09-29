-- Signal Desk schema (VS-4). Run this first, then seed.sql, in the Supabase SQL editor.
-- Drops and recreates every Signal Desk table, so running it again wipes the data.
--
-- HACKATHON ONLY: row level security is on, but the anon role may SELECT,
-- INSERT and UPDATE every table. Anyone holding the anon key can change the
-- data. A real deployment needs authenticated users and per-rep policies.
--
-- The VS-3 table dry_run_entries is left alone; drop it by hand if unwanted.

drop table if exists public.opportunities cascade;
drop table if exists public.signals cascade;
drop table if exists public.accounts cascade;
drop table if exists public.reps cascade;
drop table if exists public.settings cascade;

drop type if exists public.signal_type cascade;
drop type if exists public.signal_severity cascade;
drop type if exists public.signal_status cascade;
drop type if exists public.opportunity_stage cascade;

create type public.signal_type as enum ('drought', 'rain', 'heat');
create type public.signal_severity as enum ('High', 'Medium');
create type public.signal_status as enum ('new', 'processed');
create type public.opportunity_stage as enum ('draft', 'pushed', 'sent', 'won', 'lost');

-- Fixed small ids so the Welcome page can link to a rep without a data call.
create table public.reps (
  id smallint primary key,
  name text not null,
  territory_name text not null,
  counties text[] not null default '{}',   -- "County, ST"
  is_manager boolean not null default false
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,                       -- used for the email greeting
  county text not null,
  state text not null,
  lat double precision not null,
  lng double precision not null,
  crops text[] not null default '{}',
  acres integer not null,
  modules_owned text[] not null default '{}',
  last_contact date,
  rep_id smallint references public.reps (id)
);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  week_of date not null,
  county text not null,
  state text not null,
  lat double precision not null,
  lng double precision not null,
  type public.signal_type not null,
  severity public.signal_severity not null,
  headline text not null,
  detail text not null,
  source text not null,
  status public.signal_status not null default 'new',
  rep_id smallint references public.reps (id),
  drought_level smallint,                  -- USDM level after the change (0-4), drought only
  created_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.signals (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  rep_id smallint references public.reps (id),
  score integer not null,
  lead_with text not null,
  why_now text not null,
  email_subject text not null,
  email_body text not null,
  amount integer not null,
  stage public.opportunity_stage not null default 'draft',
  ai_offline boolean not null default false,
  sf_opportunity_id text,
  sf_error text,
  created_at timestamptz not null default now(),
  pushed_at timestamptz,
  sent_at timestamptz,
  unique (signal_id, account_id)           -- makes Generate idempotent
);

create table public.settings (
  id smallint primary key default 1 check (id = 1),
  price_list jsonb not null,
  weekly_history jsonb not null default '{}'  -- seeded sparkline numbers per rep
);

-- Row level security: on everywhere, open to anon (hackathon only, see top).
alter table public.reps enable row level security;
alter table public.accounts enable row level security;
alter table public.signals enable row level security;
alter table public.opportunities enable row level security;
alter table public.settings enable row level security;

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

create policy "anon select settings" on public.settings for select to anon using (true);
create policy "anon insert settings" on public.settings for insert to anon with check (true);
create policy "anon update settings" on public.settings for update to anon using (true) with check (true);
