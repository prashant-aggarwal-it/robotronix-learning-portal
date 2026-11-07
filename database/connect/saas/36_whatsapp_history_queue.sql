-- Coexistence history queue. DEV-first; protect large, one-time Meta history imports.
create table if not exists connect.whatsapp_history_jobs (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 channel_account_id uuid not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 payload jsonb not null,
 state text not null default 'pending' check(state in ('pending','processing','retry','completed','failed')),
 thread_index integer not null default 0 check(thread_index>=0),
 message_index integer not null default 0 check(message_index>=0),
 processed_messages integer not null default 0 check(processed_messages>=0),
 attempts integer not null default 0 check(attempts>=0),
 lease_token uuid,
 lease_until timestamptz,
 next_attempt_at timestamptz not null default now(),
 last_error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,channel_account_id,fingerprint),
 foreign key(tenant_id,channel_account_id) references connect.channel_accounts(tenant_id,id) on delete restrict
);
create index if not exists idx_connect_wa_history_pending
 on connect.whatsapp_history_jobs(state,next_attempt_at,lease_until);
alter table connect.whatsapp_history_jobs enable row level security;
revoke all on connect.whatsapp_history_jobs from public,anon,authenticated;
grant select,insert,update on connect.whatsapp_history_jobs to service_role;

create or replace function public.connect_queue_whatsapp_history(
 p_external_account_id text,p_fingerprint text,p_payload jsonb
) returns jsonb language plpgsql set search_path='' as $fn$
declare a connect.channel_accounts%rowtype;v_id uuid;v_new boolean;
begin
 if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or
  jsonb_typeof(p_payload) is distinct from 'object' or
  jsonb_typeof(p_payload->'threads') is distinct from 'array' or
  jsonb_array_length(p_payload->'threads')>500 or
  octet_length(p_payload::text)>8000000 then
  raise exception 'Invalid history queue payload' using errcode='22023';end if;
 select c.* into a from connect.channel_accounts c join connect.tenants t on t.id=c.tenant_id
 where c.provider='whatsapp' and c.external_account_id=lower(btrim(p_external_account_id))
 and c.status='active' and t.status in ('active','trial');
 if not found then raise exception 'Unregistered WhatsApp channel' using errcode='42501';end if;
 insert into connect.whatsapp_history_jobs(tenant_id,channel_account_id,fingerprint,payload)
 values(a.tenant_id,a.id,p_fingerprint,p_payload)
 on conflict(tenant_id,channel_account_id,fingerprint) do nothing returning id into v_id;
 v_new:=v_id is not null;
 if not v_new then
  select id into v_id from connect.whatsapp_history_jobs where tenant_id=a.tenant_id
  and channel_account_id=a.id and fingerprint=p_fingerprint;
 end if;
 return jsonb_build_object('ok',true,'jobId',v_id,'queued',v_new);
end $fn$;

create or replace function public.connect_claim_whatsapp_history_jobs(p_limit integer default 2)
returns jsonb language plpgsql set search_path='' as $fn$
declare v_jobs jsonb;
begin
 if p_limit not between 1 and 5 then raise exception 'Invalid worker batch' using errcode='22023';end if;
 with claim as (
  select j.id from connect.whatsapp_history_jobs j
  where (j.state in ('pending','retry') and j.next_attempt_at<=now())
  or (j.state='processing' and j.lease_until<now())
  order by j.created_at,j.id limit p_limit for update skip locked
 ), claimed as (
  update connect.whatsapp_history_jobs j set state='processing',
  attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',
  updated_at=now() from claim where j.id=claim.id
  returning j.id,j.lease_token,j.payload,j.thread_index,j.message_index,j.processed_messages,
   (select external_account_id from connect.channel_accounts a where a.id=j.channel_account_id and a.tenant_id=j.tenant_id) phone_id
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseToken',lease_token,
  'payload',payload,'threadIndex',thread_index,'messageIndex',message_index,
  'processedMessages',processed_messages,'phoneId',phone_id)),'[]'::jsonb)
 into v_jobs from claimed;
 return v_jobs;
end $fn$;

create or replace function public.connect_advance_whatsapp_history_job(
 p_id uuid,p_lease_token uuid,p_thread_index integer,p_message_index integer,
 p_imported integer,p_completed boolean default false
) returns boolean language plpgsql set search_path='' as $fn$
declare v_count int;
begin
 if p_thread_index<0 or p_message_index<0 or p_imported<0 then
  raise exception 'Invalid history progress' using errcode='22023';end if;
 update connect.whatsapp_history_jobs set thread_index=p_thread_index,message_index=p_message_index,
  processed_messages=processed_messages+p_imported,
  state=case when p_completed then 'completed' else 'processing' end,
  lease_until=case when p_completed then null else now()+interval '2 minutes' end,
  lease_token=case when p_completed then null else lease_token end,
  payload=case when p_completed then '{}'::jsonb else payload end,
  updated_at=now()
 where id=p_id and state='processing' and lease_token=p_lease_token and lease_until>now()
 and (thread_index<p_thread_index or (thread_index=p_thread_index and message_index<=p_message_index));
 get diagnostics v_count=row_count;
 return v_count=1;
end $fn$;

create or replace function public.connect_fail_whatsapp_history_job(
 p_id uuid,p_lease_token uuid,p_code text
) returns boolean language plpgsql set search_path='' as $fn$
declare v_count int;
begin
 if p_code not in ('BAD_HISTORY_PAYLOAD','HISTORY_IMPORT_FAILED','HISTORY_DB_UNAVAILABLE','HISTORY_WORKER_TIMEOUT') then
  raise exception 'Invalid error code' using errcode='22023';end if;
 update connect.whatsapp_history_jobs set
  state=case when attempts>=5 then 'failed' else 'retry' end,
  next_attempt_at=now()+make_interval(mins=>least(60,2^least(attempts,5))::integer),
  lease_token=null,lease_until=null,last_error_code=p_code,updated_at=now()
 where id=p_id and state='processing' and lease_token=p_lease_token;
 get diagnostics v_count=row_count;return v_count=1;
end $fn$;

create or replace function public.connect_whatsapp_history_queue_health(
 p_actor_id uuid,p_tenant_id uuid
) returns jsonb language sql stable set search_path='' as $fn$
 select coalesce(jsonb_agg(jsonb_build_object('channelId',a.id,
  'pending',coalesce(q.pending,0),'processing',coalesce(q.processing,0),
  'failed',coalesce(q.failed,0),'completed',coalesce(q.completed,0),
  'lastError',q.last_error)),'[]'::jsonb)
 from connect.channel_accounts a left join lateral (
  select count(*) filter(where state in ('pending','retry')) pending,
   count(*) filter(where state='processing') processing,
   count(*) filter(where state='failed') failed,
   count(*) filter(where state='completed') completed,
   max(last_error_code) filter(where state='failed') last_error
  from connect.whatsapp_history_jobs j where j.tenant_id=a.tenant_id and j.channel_account_id=a.id
 ) q on true
 where a.tenant_id=p_tenant_id and a.provider='whatsapp' and exists(
  select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('active','trial'))
$fn$;

create or replace function public.connect_cleanup_whatsapp_history_jobs()
returns integer language plpgsql set search_path='' as $fn$
declare v_deleted integer;
begin
 delete from connect.whatsapp_history_jobs where
  (state='completed' and updated_at<now()-interval '7 days') or
  (state='failed' and updated_at<now()-interval '30 days');
 get diagnostics v_deleted=row_count;return v_deleted;
end $fn$;

revoke all on function public.connect_queue_whatsapp_history(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.connect_claim_whatsapp_history_jobs(integer) from public,anon,authenticated;
revoke all on function public.connect_advance_whatsapp_history_job(uuid,uuid,integer,integer,integer,boolean) from public,anon,authenticated;
revoke all on function public.connect_fail_whatsapp_history_job(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.connect_whatsapp_history_queue_health(uuid,uuid) from public,anon,authenticated;
revoke all on function public.connect_cleanup_whatsapp_history_jobs() from public,anon,authenticated;
grant execute on function public.connect_queue_whatsapp_history(text,text,jsonb) to service_role;
grant execute on function public.connect_claim_whatsapp_history_jobs(integer) to service_role;
grant execute on function public.connect_advance_whatsapp_history_job(uuid,uuid,integer,integer,integer,boolean) to service_role;
grant execute on function public.connect_fail_whatsapp_history_job(uuid,uuid,text) to service_role;
grant execute on function public.connect_whatsapp_history_queue_health(uuid,uuid) to service_role;
grant execute on function public.connect_cleanup_whatsapp_history_jobs() to service_role;
notify pgrst,'reload schema';
