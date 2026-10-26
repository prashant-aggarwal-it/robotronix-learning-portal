-- HISTORICAL ONLY. Not part of canonical fresh install. Retained for existing-database upgrade history.
-- Robotronix Phase 2–4 additive migration for EXISTING prelaunch database.
-- Non-destructive: does not drop schemas, users, or learner records.
-- Can be rerun safely. Apply using Supabase SQL Editor, then run 03_verify.
begin;
alter table public.onboarding_submissions
  add column if not exists activated_student_id uuid references public.students(id) on delete set null;
alter table public.onboarding_submissions
  add column if not exists activated_enrollment_id uuid references public.enrollments(id) on delete set null;

-- Replace trainer availability atomically. A failed validation/INSERT rolls back deletion.
create or replace function public.replace_trainer_availability_v1(p_trainer_id uuid,p_slots jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_slot record;
 v_prior_day integer := -1;
 v_prior_end time;
 v_count integer := 0;
begin
 if auth.uid() is null or p_trainer_id is null or
    not (public.is_admin() or public.current_trainer_id()=p_trainer_id)
 then raise exception 'Trainer availability permission denied'; end if;
 if p_slots is null or jsonb_typeof(p_slots)<>'array' then raise exception 'Availability slots must be a JSON array'; end if;
 if jsonb_array_length(p_slots)>42 then raise exception 'Too many availability slots'; end if;
 perform pg_advisory_xact_lock(3210,hashtext(p_trainer_id::text));
 for v_slot in
   select * from jsonb_to_recordset(p_slots)
   as x(day_of_week integer,start_time time,end_time time,enabled boolean)
   order by day_of_week,start_time,end_time
 loop
   if v_slot.day_of_week is null or v_slot.day_of_week not between 0 and 6 or
      v_slot.start_time is null or v_slot.end_time is null or
      v_slot.start_time>=v_slot.end_time or v_slot.enabled is distinct from true
   then raise exception 'Invalid trainer availability slot'; end if;
   if v_prior_day=v_slot.day_of_week and v_slot.start_time<v_prior_end
   then raise exception 'Overlapping trainer availability slots'; end if;
   v_prior_day:=v_slot.day_of_week;
   v_prior_end:=v_slot.end_time;
   v_count:=v_count+1;
 end loop;
 delete from public.trainer_availability where trainer_id=p_trainer_id;
 insert into public.trainer_availability(trainer_id,day_of_week,start_time,end_time,enabled)
 select p_trainer_id,day_of_week,start_time,end_time,true
 from jsonb_to_recordset(p_slots)
 as x(day_of_week integer,start_time time,end_time time,enabled boolean);
 return jsonb_build_object('saved',v_count);
end $$;
revoke all on function public.replace_trainer_availability_v1(uuid,jsonb) from public,anon;
grant execute on function public.replace_trainer_availability_v1(uuid,jsonb) to authenticated;
commit;
notify pgrst, 'reload schema';
