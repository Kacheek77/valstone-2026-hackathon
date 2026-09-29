-- Repairs text that was loaded as mojibake: UTF-8 bytes read as Windows-1252,
-- so "→" became "â†’", "°" became "Â°" and "—" became "â€”".
--
-- Cause (2026-09-29): Windows PowerShell 5.1 `Get-Content -Raw` reads a UTF-8
-- file without a BOM as Windows-1252. Load seed files with
-- `Get-Content -Raw -Encoding UTF8` instead, or paste from an editor that reads
-- the file as UTF-8.
--
-- Safe to rerun: each update only touches values that still contain the
-- mojibake markers, and a repaired value no longer matches them. The same
-- repair was applied in place on 2026-09-29 (29 signals, 45 opportunities).

create or replace function pg_temp.unmangle(t text) returns text
language sql immutable as $$
  select case
    when t ~ '(â€|â†|Â°|Â·|Ã)' then convert_from(convert_to(t, 'WIN1252'), 'UTF8')
    else t
  end
$$;

update public.signals set
  headline = pg_temp.unmangle(headline),
  detail = pg_temp.unmangle(detail),
  source = pg_temp.unmangle(source)
where headline ~ '(â€|â†|Â°|Â·|Ã)' or detail ~ '(â€|â†|Â°|Â·|Ã)' or source ~ '(â€|â†|Â°|Â·|Ã)';

update public.opportunities set
  why_now = pg_temp.unmangle(why_now),
  email_subject = pg_temp.unmangle(email_subject),
  email_body = pg_temp.unmangle(email_body),
  lead_with = pg_temp.unmangle(lead_with)
where why_now ~ '(â€|â†|Â°|Â·|Ã)' or email_subject ~ '(â€|â†|Â°|Â·|Ã)'
   or email_body ~ '(â€|â†|Â°|Â·|Ã)' or lead_with ~ '(â€|â†|Â°|Â·|Ã)';

update public.accounts set
  name = pg_temp.unmangle(name),
  contact_name = pg_temp.unmangle(contact_name),
  contact_role = pg_temp.unmangle(contact_role),
  notes = pg_temp.unmangle(notes)
where name ~ '(â€|â†|Â°|Â·|Ã)' or contact_name ~ '(â€|â†|Â°|Â·|Ã)'
   or contact_role ~ '(â€|â†|Â°|Â·|Ã)' or notes ~ '(â€|â†|Â°|Â·|Ã)';

update public.reps set
  name = pg_temp.unmangle(name),
  territory_name = pg_temp.unmangle(territory_name),
  voice_note = pg_temp.unmangle(voice_note)
where name ~ '(â€|â†|Â°|Â·|Ã)' or territory_name ~ '(â€|â†|Â°|Â·|Ã)' or voice_note ~ '(â€|â†|Â°|Â·|Ã)';

-- Anything still garbled after this shows up here (expect zero rows).
select 'signals' as t, id from public.signals where headline ~ '(â€|â†|Â°)' or detail ~ '(â€|â†|Â°)'
union all
select 'opportunities', id from public.opportunities where why_now ~ '(â€|â†|Â°)' or email_body ~ '(â€|â†|Â°)' or email_subject ~ '(â€|â†|Â°)';
