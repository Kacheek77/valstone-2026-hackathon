-- VS-10 (optional): lets Reset demo delete signals that are not in the seed,
-- instead of retiring them to week_of 1970-01-05. Hackathon only.
grant delete on public.signals to anon;
drop policy if exists "anon delete signals" on public.signals;
create policy "anon delete signals" on public.signals for delete to anon using (true);
