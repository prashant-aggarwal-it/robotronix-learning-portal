begin;
create table if not exists saas.customer_invitation_webhook_events(
 event_id text primary key,
 message_id text not null,
 event_type text not null,
 received_at timestamptz not null default now()
);
alter table saas.customer_invitation_webhook_events enable row level security;
revoke all on saas.customer_invitation_webhook_events from public,anon,authenticated;
grant select,insert on saas.customer_invitation_webhook_events to service_role;
create or replace function public.saas_invitation_delivery_webhook_v1(p_event_id text,p_message_id text,p_type text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare d saas.customer_invitation_deliveries%rowtype;target text;
begin
 if auth.role()<>'service_role' then raise exception 'Service only' using errcode='42501';end if;
 if length(coalesce(p_event_id,'')) not between 1 and 200 or length(coalesce(p_message_id,'')) not between 1 and 200
 then raise exception 'Invalid event' using errcode='22023';end if;
 target:=case p_type when 'email.delivered' then 'delivered' when 'email.bounced' then 'bounced'
 when 'email.complained' then 'complained' else null end;
 if target is null then return jsonb_build_object('ignored',true);end if;
 select * into d from saas.customer_invitation_deliveries where provider_message_id=p_message_id for update;
 if not found then return jsonb_build_object('ignored',true);end if;
 insert into saas.customer_invitation_webhook_events(event_id,message_id,event_type)
 values(p_event_id,p_message_id,p_type) on conflict(event_id) do nothing;
 if not found then return jsonb_build_object('duplicate',true);end if;
 -- Terminal failure must not be reverted by out-of-order delivery events.
 if d.status in ('bounced','complained') then return jsonb_build_object('ignored',true);end if;
 if target='delivered' and d.status not in ('provider_accepted','delivered') then return jsonb_build_object('ignored',true);end if;
 update saas.customer_invitation_deliveries set status=target,updated_at=now() where id=d.id;
 return jsonb_build_object('updated',true,'status',target);
end $$;
revoke all on function public.saas_invitation_delivery_webhook_v1(text,text,text) from public,anon,authenticated;
grant execute on function public.saas_invitation_delivery_webhook_v1(text,text,text) to service_role;
commit;