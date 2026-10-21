-- For database already installed before this fix. New installs include it in 01_CREATE_SCHEMA.sql.
-- Trainer-origin availability updates: one Admin notification per successful user action.
-- Called only after an availability/override save or deletion succeeds.
create or replace function public.notify_admin_trainer_availability_change(p_trainer_id uuid,p_change_kind text)
returns void language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
 if auth.uid() is null or p_trainer_id is null
    or public.current_trainer_id() is distinct from p_trainer_id then
  raise exception 'Only the linked trainer may report their own availability change';
 end if;
 if p_change_kind not in ('weekly','override_added','override_removed') then
  raise exception 'Unsupported availability change kind';
 end if;
 select full_name into v_name from public.trainers where id=p_trainer_id;
 insert into public.portal_notifications(recipient_role,trainer_id,type,priority,title,message,href)
 values('admin',p_trainer_id,'trainer_availability_changed','action',
        'Trainer availability updated',
        coalesce(nullif(v_name,''),'A trainer') || case p_change_kind
          when 'weekly' then ' updated weekly working hours.'
          when 'override_added' then ' added leave or special availability.'
          else ' removed a leave or special availability entry.' end,
        '/admin/trainers/'||p_trainer_id::text);
end $$;
revoke all on function public.notify_admin_trainer_availability_change(uuid,text) from public,anon;
grant execute on function public.notify_admin_trainer_availability_change(uuid,text) to authenticated;
