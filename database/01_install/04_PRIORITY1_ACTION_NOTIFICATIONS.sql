-- Robotronix P1 action-required notifications (idempotent).
-- Run against DEV first. For an EXISTING installation this is a controlled migration;
-- fresh installations also include this content at the end of 01_CREATE_SCHEMA.sql.
begin;

-- Trainer payout: notify Admin when submitted, trainer when reviewed.
-- Never place account, UPI, PAN, IFSC or trainer notes in notification text.
create or replace function public.notify_trainer_payout_action()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
  select coalesce(nullif(trim(full_name),''),'Trainer')
    into v_name from public.trainers where id=new.trainer_id;
  if tg_op='INSERT' and new.status='pending' then
    insert into public.portal_notifications
      (recipient_role,trainer_id,type,priority,title,message,href,dedupe_key)
    values
      ('admin',new.trainer_id,'trainer_payout_review','action',
       'Trainer payout change needs review',
       coalesce(v_name,'Trainer')||' submitted new payout details for review.',
       '/admin/trainers/'||new.trainer_id::text,
       'trainer-payout:'||new.id::text||':submitted')
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  elsif tg_op='UPDATE' and new.status is distinct from old.status
    and new.status in ('approved','rejected','correction_requested') then
    insert into public.portal_notifications
      (recipient_role,trainer_id,type,priority,title,message,href,dedupe_key)
    values
      ('trainer',new.trainer_id,'trainer_payout_decision',
       case when new.status='correction_requested' then 'action' else 'important' end,
       case new.status
         when 'approved' then 'Payout details approved'
         when 'rejected' then 'Payout details not approved'
         else 'Payout details need correction' end,
       case new.status
         when 'approved' then 'Your submitted payout details have been approved. Check the effective payroll cycle with Admin.'
         when 'rejected' then 'Admin did not approve your payout changes. Contact Robotronix Admin for clarification.'
         else 'Admin requested a correction to your submitted payout details. Open your profile to review.' end,
       '/trainer/profile',
       'trainer-payout:'||new.id::text||':'||new.status)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trainer_payout_action_insert_trg on public.trainer_finance_change_requests;
create trigger trainer_payout_action_insert_trg
after insert on public.trainer_finance_change_requests
for each row execute function public.notify_trainer_payout_action();
drop trigger if exists trainer_payout_action_update_trg on public.trainer_finance_change_requests;
create trigger trainer_payout_action_update_trg
after update of status on public.trainer_finance_change_requests
for each row execute function public.notify_trainer_payout_action();

-- Open urgent progress alerts need Admin attention, and subsequent updates should not
-- re-notify unless an alert is explicitly re-opened.
create or replace function public.notify_open_progress_alert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='open'
     and (tg_op='INSERT' or new.status is distinct from old.status) then
    insert into public.portal_notifications
      (recipient_role,student_id,type,priority,title,message,href,dedupe_key)
    values
      ('admin',new.student_id,'progress_alert_open','action',
       'Learner progress alert requires review',
       'A learner progress alert needs an Admin review.',
       '/admin/alerts',
       'progress-alert:'||new.id::text||':open:'||extract(epoch from new.updated_at)::bigint::text)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end $$;
drop trigger if exists progress_action_insert_trg on public.progress_alert_actions;
create trigger progress_action_insert_trg after insert on public.progress_alert_actions
for each row execute function public.notify_open_progress_alert();
drop trigger if exists progress_action_update_trg on public.progress_alert_actions;
create trigger progress_action_update_trg after update of status on public.progress_alert_actions
for each row execute function public.notify_open_progress_alert();

-- Existing message trigger incorrectly routes trainer-originated messages to Parent
-- even when there is no Parent on the thread. Correct routing, do not expose message
-- bodies in notifications, and keep unread counts aligned with actual recipients.
create or replace function public.handle_communication_message()
returns trigger language plpgsql security definer set search_path=public as $$
declare t public.communication_threads%rowtype;
begin
 select * into t from public.communication_threads where id=new.thread_id;
 if not found then return new; end if;
 update public.communication_threads set
  last_message_at=new.created_at,
  last_message_preview=left(new.body,240),
  status=case
    when new.sender_role='parent' then 'waiting_team'
    when new.sender_role='trainer' then 'waiting_team'
    when t.parent_id is not null then 'waiting_parent'
    else 'open' end,
  unread_admin=case when new.sender_role in ('parent','trainer') then unread_admin+1 else unread_admin end,
  unread_parent=case when new.sender_role<>'parent' and t.parent_id is not null then unread_parent+1 else unread_parent end,
  unread_trainer=case when new.sender_role<>'trainer' and t.trainer_id is not null then unread_trainer+1 else unread_trainer end,
  updated_at=now()
 where id=new.thread_id;

 if new.sender_role in ('parent','trainer') then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('admin',t.student_id,t.trainer_id,'message_received','action',
   case when new.sender_role='parent' then 'Parent message awaiting response' else 'Trainer message awaiting response' end,
   'A new message in your Robotronix inbox needs attention.',
   '/admin/messages/'||new.thread_id::text,
   'message:'||new.id::text||':admin')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 if new.sender_role='parent' and t.trainer_id is not null then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('trainer',t.student_id,t.trainer_id,'message_received','action',
   'Parent message awaiting reply','A parent sent a message about a learner.',
   '/trainer/messages/'||new.thread_id::text,'message:'||new.id::text||':trainer')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 if new.sender_role='admin' and t.trainer_id is not null then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('trainer',t.student_id,t.trainer_id,'message_received','action',
   'Message from Robotronix Admin','You have a new Admin message.',
   '/trainer/messages/'||new.thread_id::text,'message:'||new.id::text||':trainer')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 if new.sender_role<>'parent' and t.parent_id is not null then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('parent',t.student_id,t.trainer_id,'message_received','action',
   'New Robotronix message','You have a new message in the family inbox.',
   '/parent/messages/'||new.thread_id::text,'message:'||new.id::text||':parent')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 return new;
end $$;

-- Existing class scheduling trigger already notifies trainers and families.
-- Notify Admin for cancellations/reschedules made by other roles, not Admin's own edits.
create or replace function public.notify_admin_critical_schedule_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if public.is_admin() then return new; end if;
 if new.event_type='class' and
   ((new.status in ('cancelled','rescheduled') and new.status is distinct from old.status)
      or new.date is distinct from old.date
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time) then
  insert into public.portal_notifications
    (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('admin',new.student_id,new.trainer_id,'class_change_review','action',
    'Class schedule change requires review',
    'A class was cancelled or its schedule changed. Review the affected class.',
    '/admin/schedule',
    'critical-class-change:'||new.id::text||':'||new.updated_at::text)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 return new;
end $$;
drop trigger if exists schedule_admin_action_update_trg on public.schedule_events;
create trigger schedule_admin_action_update_trg
after update of status,date,start_time,end_time on public.schedule_events
for each row execute function public.notify_admin_critical_schedule_change();

commit;
