-- Zoom Classroom V2 just-in-time provisioning: concurrency lease for a schedule event.
-- Fresh-install canonical module. This table is service-role-only and never exposed to browser clients.
begin;
create table if not exists public.zoom_class_provisioning_leases(
 schedule_event_id uuid primary key references public.schedule_events(id) on delete cascade,
 lease_token uuid not null,
 lease_until timestamptz not null,
 updated_at timestamptz not null default now()
);
create index if not exists zoom_class_provisioning_lease_expiry_idx on public.zoom_class_provisioning_leases(lease_until);
alter table public.zoom_class_provisioning_leases enable row level security;
revoke all on public.zoom_class_provisioning_leases from anon,authenticated;
grant all on public.zoom_class_provisioning_leases to service_role;

create or replace function public.claim_zoom_class_provisioning(p_event_id uuid,p_token uuid)
returns boolean language plpgsql security invoker set search_path=public
as $$
declare v_rows integer;
begin
 if p_event_id is null or p_token is null then return false; end if;
 insert into public.zoom_class_provisioning_leases(schedule_event_id,lease_token,lease_until,updated_at)
 values(p_event_id,p_token,now()+interval '2 minutes',now())
 on conflict(schedule_event_id) do update
 set lease_token=excluded.lease_token,lease_until=excluded.lease_until,updated_at=now()
 where public.zoom_class_provisioning_leases.lease_until<now();
 get diagnostics v_rows=row_count;
 return v_rows=1;
end $$;
revoke all on function public.claim_zoom_class_provisioning(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_zoom_class_provisioning(uuid,uuid) to service_role;

create or replace function public.release_zoom_class_provisioning(p_event_id uuid,p_token uuid)
returns void language plpgsql security invoker set search_path=public
as $$
begin
 delete from public.zoom_class_provisioning_leases
 where schedule_event_id=p_event_id and lease_token=p_token;
end $$;
revoke all on function public.release_zoom_class_provisioning(uuid,uuid) from public,anon,authenticated;
grant execute on function public.release_zoom_class_provisioning(uuid,uuid) to service_role;
commit;
notify pgrst, 'reload schema';
