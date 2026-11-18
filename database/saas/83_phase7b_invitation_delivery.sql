begin;
create table if not exists saas.customer_invitation_deliveries(
 id uuid primary key default gen_random_uuid(),
 invitation_id uuid not null references saas.pending_customer_invitations(id) on delete cascade,
 token_version int not null default 1,
 status text not null default 'queued' check(status in ('queued','sending','provider_accepted','delivered','failed','bounced','complained')),
 provider text not null default 'resend',
 provider_message_id text,
 attempts int not null default 0,
 last_attempt_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(invitation_id,token_version)
);
create unique index if not exists customer_invitation_provider_msg_idx on saas.customer_invitation_deliveries(provider_message_id) where provider_message_id is not null;
alter table saas.customer_invitation_deliveries enable row level security;
revoke all on saas.customer_invitation_deliveries from public,anon,authenticated;
grant select,insert,update,delete on saas.customer_invitation_deliveries to service_role;
create or replace function public.saas_invitation_delivery_admin_v1(p_actor uuid,p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v saas.customer_invitation_deliveries%rowtype;inv saas.pending_customer_invitations%rowtype;
begin
 if auth.role()<>'service_role' or not exists(select 1 from saas.platform_administrators where user_id=p_actor and active)
 then raise exception 'Platform Admin required' using errcode='42501';end if;
 if p_action='queue' then
  select * into inv from saas.pending_customer_invitations where id=(p_data->>'invitationId')::uuid for update;
  if not found or inv.status<>'pending' or inv.expires_at<=now() then raise exception 'Invitation unavailable' using errcode='42501';end if;
  insert into saas.customer_invitation_deliveries(invitation_id,token_version)
  values(inv.id,coalesce((select max(token_version)+1 from saas.customer_invitation_deliveries where invitation_id=inv.id),1))
  returning * into v;
 elsif p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('invitation_id',invitation_id,'id',id,'status',status,'provider_message_id',provider_message_id,'attempts',attempts,'last_attempt_at',last_attempt_at,'last_error',last_error,'updated_at',updated_at) order by created_at desc)
   from saas.customer_invitation_deliveries),'[]'::jsonb);
 elsif p_action='sending' then
  update saas.customer_invitation_deliveries set status='sending',attempts=attempts+1,last_attempt_at=now(),updated_at=now() where id=(p_data->>'id')::uuid and status in ('queued','failed') and attempts<3 returning * into v;
 elsif p_action='result' then
  update saas.customer_invitation_deliveries set status=case when p_data->>'ok'='true' then 'provider_accepted' else 'failed' end,
   provider_message_id=case when p_data->>'ok'='true' then p_data->>'messageId' else provider_message_id end,
   last_error=case when p_data->>'ok'='true' then null else 'Provider delivery request failed' end,updated_at=now()
   where id=(p_data->>'id')::uuid and status='sending' returning * into v;
 else raise exception 'Invalid action' using errcode='22023';end if;
 if not found then raise exception 'Delivery state conflict' using errcode='23514';end if;
 return jsonb_build_object('id',v.id,'status',v.status,'attempts',v.attempts);
end $$;
revoke all on function public.saas_invitation_delivery_admin_v1(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.saas_invitation_delivery_admin_v1(uuid,text,jsonb) to service_role;
commit;