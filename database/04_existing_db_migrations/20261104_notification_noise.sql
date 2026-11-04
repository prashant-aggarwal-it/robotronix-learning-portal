-- Robotronix notification-noise fix for EXISTING databases only.
-- REVIEW AND TEST IN DEV before approving any production application.
-- Never apply the fresh-install schema to an existing database.
-- This migration preserves all historical notifications, including unread status.
begin;

-- 02_scheduling_operations.sql provides this column/index on fresh installations.
alter table public.portal_notifications add column if not exists dedupe_key text;
create unique index if not exists portal_notifications_dedupe_uidx
  on public.portal_notifications(dedupe_key) where dedupe_key is not null;

create or replace function public.notify_schedule_change() returns trigger language plpgsql security definer set search_path=public as $$
declare
  event_type text;
  title_text text;
  msg text;
  severity text;
  notification_key text;
begin
  -- Batch scheduling already produces one role-specific summary per generated plan.
  if tg_op='INSERT' and current_setting('robotronix.bulk_schedule_notifications',true)='on' then return new; end if;

  if tg_op='INSERT' then
    event_type:='class_scheduled'; title_text:='Class scheduled'; severity:='info';
  elsif new.status='cancelled' and old.status is distinct from new.status then
    event_type:='class_cancelled'; title_text:='Class cancelled'; severity:='important';
  elsif new.date is distinct from old.date
     or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or (new.status='rescheduled' and old.status is distinct from new.status) then
    event_type:='class_rescheduled'; title_text:='Class schedule updated'; severity:='important';
  else
    return new;
  end if;

  msg:=left(coalesce(nullif(trim(new.title),''),'Class'),120)||' · '||
       to_char(new.date,'DD Mon YYYY')||' · '||
       to_char(new.start_time,'HH24:MI')||' ('||coalesce(new.timezone,'Asia/Kolkata')||').';
  -- Stable state-based key prevents repeated writes for the same schedule state.
  notification_key:='schedule:'||new.id::text||':'||event_type||':'||
    new.date::text||':'||new.start_time::text||':'||
    new.end_time::text||':'||new.status;

  if new.student_id is not null then
    insert into public.portal_notifications
      (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
    values
      ('parent',new.student_id,new.trainer_id,event_type,severity,title_text,msg,
       '/parent/calendar',notification_key||':parent'),
      ('student',new.student_id,new.trainer_id,event_type,severity,title_text,msg,
       '/student',notification_key||':student')
    on conflict(dedupe_key) where dedupe_key is not null do nothing;
  end if;
  if new.trainer_id is not null then
    insert into public.portal_notifications
      (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
    values
      ('trainer',new.student_id,new.trainer_id,event_type,severity,title_text,msg,
       '/trainer/schedule',notification_key||':trainer')
    on conflict(dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end $$;

-- Correct the historical severity of routine parent "class scheduled" announcements.
-- Changes categorization, not read state or history. Does not touch cancellations.
update public.portal_notifications
  set priority='info'
where type='class_scheduled' and priority='action';

commit;

-- READ-ONLY VALIDATION after DEV migration:
-- select type,recipient_role,priority,count(*)
--   from public.portal_notifications
--   where type like 'class_%'
--   group by 1,2,3 order by 1,2,3;
-- select pg_get_functiondef('public.notify_schedule_change()'::regprocedure);
