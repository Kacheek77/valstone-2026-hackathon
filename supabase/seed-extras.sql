-- Signal Desk seed extras (VS-5). Run after seed.sql, which stays a verbatim
-- copy of the supplied dataset. Re-run this whenever seed.sql is re-run.

update public.reps set voice_note = 'Short sentences. No exclamation marks. Sign off ''Talk soon, Renee.''' where id = 'REP-04';
update public.reps set voice_note = 'Plain and neighborly; mention the county by name; sign off ''Jordan''' where id = 'REP-01';
update public.reps set voice_note = null where id = 'REP-05';
