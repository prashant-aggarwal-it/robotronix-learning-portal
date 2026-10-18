-- Robotronix Learning Portal — Live Data Hardening V1
-- Adds selected operational tables to Supabase Realtime publication.
-- Safe to run repeatedly.

begin;

do $$
declare
  t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array[
      'portal_notifications',
      'demo_guest_requests',
      'demo_sessions',
      'demo_session_participants',
      'schedule_events',
      'onboarding_submissions',
      'class_attendance',
      'session_records',
      'learning_observations',
      'student_invoices',
      'student_fee_payments',
      'trainer_earnings'
    ]
    loop
      if exists(
        select 1 from pg_class c
        join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname=t and c.relkind='r'
      ) and not exists(
        select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename=t
      ) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
