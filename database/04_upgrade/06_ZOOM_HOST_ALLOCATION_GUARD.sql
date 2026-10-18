-- Robotronix Zoom Phase 1: transaction-safe host conflict protection.
-- Run after Zoom Classroom migrations. Existing conflicts must be resolved first.
begin;
create extension if not exists btree_gist;
do $$
begin
 if exists (
  select 1 from public.zoom_meetings a
  join public.zoom_meetings b on a.id < b.id
   and a.host_account_id=b.host_account_id
   and tstzrange(a.scheduled_start,a.scheduled_start+a.duration_minutes*interval '1 minute','[)')
    && tstzrange(b.scheduled_start,b.scheduled_start+b.duration_minutes*interval '1 minute','[)')
  where a.status in ('scheduled','started') and b.status in ('scheduled','started')
    and a.scheduled_start is not null and b.scheduled_start is not null
    and a.duration_minutes>0 and b.duration_minutes>0
 ) then
  raise exception 'Existing overlapping Zoom meetings detected. Correct them before installing the host allocation guard.';
 end if;
end $$;
do $$
begin
 if not exists(select 1 from pg_constraint where conname='zoom_host_active_meeting_no_overlap' and conrelid='public.zoom_meetings'::regclass) then
  alter table public.zoom_meetings
   add constraint zoom_host_active_meeting_no_overlap
   exclude using gist (
    host_account_id with =,
    tstzrange(scheduled_start, scheduled_start + duration_minutes * interval '1 minute', '[)') with &&
   )
   where (status in ('scheduled','started') and scheduled_start is not null and duration_minutes > 0);
 end if;
end $$;
commit;
