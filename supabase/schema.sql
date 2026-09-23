-- VS-3 dry run: one table, RLS on, anon may insert and select.
-- Run this once in the Supabase SQL editor.

create table public.dry_run_entries (
  id uuid primary key default gen_random_uuid(),
  note text not null,
  created_at timestamptz default now()
);

alter table public.dry_run_entries enable row level security;

create policy "anon can insert dry_run_entries"
  on public.dry_run_entries
  for insert
  to anon
  with check (true);

create policy "anon can select dry_run_entries"
  on public.dry_run_entries
  for select
  to anon
  using (true);
