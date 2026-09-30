-- VS-12 (2026-09-29): run once in the Supabase SQL editor. Safe to run again.
-- The app works before this runs; the features below switch on once it has.

-- T8: the customer's reply, logged by the rep on the opportunity.
alter table public.opportunities add column if not exists responded_at timestamptz;
alter table public.opportunities add column if not exists response text
  check (response in ('interested', 'not_now', 'not_interested'));
alter table public.opportunities add column if not exists response_note text;

-- T8: remaining steps are marked skipped after an Interested or Not now reply.
alter table public.outreach_steps drop constraint if exists outreach_steps_status_check;
alter table public.outreach_steps add constraint outreach_steps_status_check
  check (status in ('planned', 'scheduled', 'done', 'skipped'));

-- T7: Reschedule from today stores the new due date per step.
alter table public.outreach_steps add column if not exists due_on date;

-- T10: seed why-now wording (seed opportunities only). Reset demo writes the
-- same corrected text from lib/seed-snapshot.json.
update public.opportunities
set why_now = replace(why_now, ', which D', ', which moved from D')
where id in (
  'OPP-0001', 'OPP-0002', 'OPP-0003', 'OPP-0004', 'OPP-0005', 'OPP-0006', 'OPP-0007', 'OPP-0008', 'OPP-0009', 'OPP-0010',
  'OPP-0011', 'OPP-0012', 'OPP-0013', 'OPP-0014', 'OPP-0015', 'OPP-0016', 'OPP-0017', 'OPP-0018', 'OPP-0019', 'OPP-0020',
  'OPP-0021', 'OPP-0022', 'OPP-0023', 'OPP-0024', 'OPP-0025', 'OPP-0026', 'OPP-0027', 'OPP-0028', 'OPP-0029', 'OPP-0030',
  'OPP-0031', 'OPP-0032', 'OPP-0033', 'OPP-0034', 'OPP-0035', 'OPP-0036', 'OPP-0037', 'OPP-0038', 'OPP-0200', 'OPP-0201',
  'OPP-0202', 'OPP-0203', 'OPP-0204', 'OPP-0205', 'OPP-0206', 'OPP-0207', 'OPP-0208', 'OPP-0209', 'OPP-0210', 'OPP-0211',
  'OPP-0212', 'OPP-0213', 'OPP-0214', 'OPP-0215', 'OPP-0216', 'OPP-0217', 'OPP-0218', 'OPP-0219', 'OPP-0220', 'OPP-0221',
  'OPP-0222', 'OPP-0223'
) and why_now like '%, which D%';

update public.opportunities
set why_now = replace(why_now,
  'a watering plan pays for itself in the week allocations tighten',
  'planning field-work days around the water that is left pays for itself this week')
where lead_with = 'Field-Work Planner' and id in (
  'OPP-0001', 'OPP-0002', 'OPP-0003', 'OPP-0004', 'OPP-0005', 'OPP-0006', 'OPP-0007', 'OPP-0008', 'OPP-0009', 'OPP-0010',
  'OPP-0011', 'OPP-0012', 'OPP-0013', 'OPP-0014', 'OPP-0015', 'OPP-0016', 'OPP-0017', 'OPP-0018', 'OPP-0019', 'OPP-0020',
  'OPP-0021', 'OPP-0022', 'OPP-0023', 'OPP-0024', 'OPP-0025', 'OPP-0026', 'OPP-0027', 'OPP-0028', 'OPP-0029', 'OPP-0030',
  'OPP-0031', 'OPP-0032', 'OPP-0033', 'OPP-0034', 'OPP-0035', 'OPP-0036', 'OPP-0037', 'OPP-0038', 'OPP-0200', 'OPP-0201',
  'OPP-0202', 'OPP-0203', 'OPP-0204', 'OPP-0205', 'OPP-0206', 'OPP-0207', 'OPP-0208', 'OPP-0209', 'OPP-0210', 'OPP-0211',
  'OPP-0212', 'OPP-0213', 'OPP-0214', 'OPP-0215', 'OPP-0216', 'OPP-0217', 'OPP-0218', 'OPP-0219', 'OPP-0220', 'OPP-0221',
  'OPP-0222', 'OPP-0223'
);

update public.opportunities
set why_now = replace(why_now,
  'a watering plan pays for itself in the week allocations tighten',
  'yield records kept now are what a crop insurance claim will need')
where lead_with = 'Yield & Insurance Records' and id in (
  'OPP-0001', 'OPP-0002', 'OPP-0003', 'OPP-0004', 'OPP-0005', 'OPP-0006', 'OPP-0007', 'OPP-0008', 'OPP-0009', 'OPP-0010',
  'OPP-0011', 'OPP-0012', 'OPP-0013', 'OPP-0014', 'OPP-0015', 'OPP-0016', 'OPP-0017', 'OPP-0018', 'OPP-0019', 'OPP-0020',
  'OPP-0021', 'OPP-0022', 'OPP-0023', 'OPP-0024', 'OPP-0025', 'OPP-0026', 'OPP-0027', 'OPP-0028', 'OPP-0029', 'OPP-0030',
  'OPP-0031', 'OPP-0032', 'OPP-0033', 'OPP-0034', 'OPP-0035', 'OPP-0036', 'OPP-0037', 'OPP-0038', 'OPP-0200', 'OPP-0201',
  'OPP-0202', 'OPP-0203', 'OPP-0204', 'OPP-0205', 'OPP-0206', 'OPP-0207', 'OPP-0208', 'OPP-0209', 'OPP-0210', 'OPP-0211',
  'OPP-0212', 'OPP-0213', 'OPP-0214', 'OPP-0215', 'OPP-0216', 'OPP-0217', 'OPP-0218', 'OPP-0219', 'OPP-0220', 'OPP-0221',
  'OPP-0222', 'OPP-0223'
);
