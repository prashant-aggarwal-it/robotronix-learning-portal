-- Phase 5 compatibility: keep V2 task context in future recurring occurrences.
-- Runs only on INSERT with a pre-existing completed task in the same recurrence series.
-- No legacy task_update rewrite; no change to original task, CRM links or reminder timing.
begin;
create function tasks.v2_inherit_recurring_context()
returns trigger language plpgsql set search_path to '' as $$
declare prior tasks.items%rowtype;
begin
 if new.recurrence_series_id is null or new.recurrence='none' then return new;end if;
 select * into prior from tasks.items t
 where t.owner_user_id=new.owner_user_id
   and t.recurrence_series_id=new.recurrence_series_id
   and t.status='done'
 order by t.completed_at desc nulls last,t.created_at desc,t.id desc
 limit 1;
 if prior.id is null then return new;end if;
 new.area_id:=coalesce(new.area_id,prior.area_id);
 new.project_id:=coalesce(new.project_id,prior.project_id);
 new.important:=prior.important;
 new.urgent:=prior.urgent;
 new.estimated_minutes:=prior.estimated_minutes;
 new.done_definition:=prior.done_definition;
 new.board_rank:=(
  select coalesce(max(i.board_rank),0)+1024 from tasks.items i
  where i.owner_user_id=new.owner_user_id and i.status='todo' and i.archived_at is null
 );
 -- Resume notes are specific to the previous work session, not the new occurrence.
 new.resume_note:='';
 new.someday:=false;
 new.reschedule_count:=0;
 return new;
end $$;
create trigger tasks_v2_inherit_recurring_context
before insert on tasks.items for each row
execute function tasks.v2_inherit_recurring_context();
commit;
