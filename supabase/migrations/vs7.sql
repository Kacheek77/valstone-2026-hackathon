-- VS-7 additive migration: safe to run on a live VS-6 database without
-- touching existing rows. schema.sql already includes all of this, so a full
-- schema.sql + seed.sql re-run does not need it.

alter table public.accounts add column if not exists contact_role text;
alter table public.accounts add column if not exists notes text;

create table if not exists public.outreach_steps (
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

alter table public.outreach_steps enable row level security;
drop policy if exists "anon select outreach_steps" on public.outreach_steps;
drop policy if exists "anon insert outreach_steps" on public.outreach_steps;
drop policy if exists "anon update outreach_steps" on public.outreach_steps;
drop policy if exists "anon delete outreach_steps" on public.outreach_steps;
create policy "anon select outreach_steps" on public.outreach_steps for select to anon using (true);
create policy "anon insert outreach_steps" on public.outreach_steps for insert to anon with check (true);
create policy "anon update outreach_steps" on public.outreach_steps for update to anon using (true) with check (true);
create policy "anon delete outreach_steps" on public.outreach_steps for delete to anon using (true);
grant select, insert, update, delete on public.outreach_steps to anon;
