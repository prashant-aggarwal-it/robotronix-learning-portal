-- Connect CRM calendar management fields and tenant-scoped RPCs.
-- DEV first. Review before applying to production.
alter table connect.appointments add column if not exists location text;
alter table connect.appointments add column if not exists meeting_url text;
alter table connect.appointments add column if not exists notes text;
alter table connect.appointments add column if not exists programme text;
alter table connect.appointments add column if not exists version integer not null default 1;
alter table connect.appointments add column if not exists updated_at timestamptz not null default now();

CREATE OR REPLACE FUNCTION public.connect_calendar_list(p_actor_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_member uuid;v_result jsonb;
begin
 select m.id into v_member from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace read access denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at,x.id),'[]'::jsonb) into v_result
 from (select a.id,a.title,a.kind,a.status,a.person_id,a.opportunity_id,
 a.owner_membership_id,a.starts_at,a.ends_at,a.location,a.meeting_url,a.notes,a.programme,a.version,a.updated_at
 from connect.appointments a where a.tenant_id=p_tenant_id order by a.starts_at,a.id limit 500) x;
 return jsonb_build_object('items',v_result);
end $function$
;

CREATE OR REPLACE FUNCTION public.connect_calendar_save(p_actor_id uuid, p_tenant_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_id uuid;v_person uuid;v_opportunity uuid;v_owner uuid;
 v_starts timestamptz;v_ends timestamptz;v_title text;v_kind text;v_location text;v_meeting text;v_notes text;v_programme text;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null or v_role='viewer' then raise exception 'Calendar write access denied' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid calendar payload' using errcode='22023';end if;
 v_id:=nullif(p_data->>'id','')::uuid;
 v_title:=nullif(btrim(p_data->>'title'),'');
 v_kind:=p_data->>'kind';
 v_person:=nullif(p_data->>'personId','')::uuid;
 v_opportunity:=nullif(p_data->>'opportunityId','')::uuid;
 v_owner:=nullif(p_data->>'ownerMemberId','')::uuid;
 v_location:=nullif(btrim(p_data->>'location'),'');
 v_meeting:=nullif(btrim(p_data->>'meetingUrl'),'');
 v_notes:=nullif(btrim(p_data->>'notes'),'');
 v_programme:=nullif(btrim(p_data->>'programme'),'');
 if v_title is null or length(v_title)>250 or v_kind not in ('counselling','demo','trial','meeting') then
  raise exception 'Invalid title or appointment type' using errcode='22023';end if;
 if v_person is null and v_opportunity is null then raise exception 'Contact or admission required' using errcode='22023';end if;
 if (v_location is not null and length(v_location)>250) or (v_notes is not null and length(v_notes)>2000)
   or (v_programme is not null and length(v_programme)>160) or
   (v_meeting is not null and (length(v_meeting)>500 or v_meeting !~* '^https://[^[:space:]]+$')) then
  raise exception 'Invalid appointment details' using errcode='22023';end if;
 if v_person is not null and not exists(select 1 from connect.people where id=v_person and tenant_id=p_tenant_id and status='active') then
  raise exception 'Contact is not in this workspace' using errcode='42501';end if;
 if v_opportunity is not null and not exists(select 1 from connect.opportunities where id=v_opportunity and tenant_id=p_tenant_id) then
  raise exception 'Admission is not in this workspace' using errcode='42501';end if;
 if v_owner is not null and not exists(select 1 from connect.memberships where id=v_owner and tenant_id=p_tenant_id and status='active') then
  raise exception 'Assigned staff member is not active' using errcode='42501';end if;
 if v_owner is not null and v_owner<>v_member and v_role not in ('owner','admin','manager') then
  raise exception 'Staff assignment requires manager access' using errcode='42501';end if;
 begin
  v_starts:=(p_data->>'startsAt')::timestamptz;
  v_ends:=(p_data->>'endsAt')::timestamptz;
 exception when others then raise exception 'Invalid appointment dates' using errcode='22023';end;
 if v_starts is null or v_ends is null or v_starts>=v_ends or v_ends>v_starts+interval '24 hours' then
  raise exception 'Appointment must end after it starts, within 24 hours' using errcode='22023';end if;
 if v_id is null then
  insert into connect.appointments(tenant_id,person_id,opportunity_id,owner_membership_id,title,kind,starts_at,ends_at,
   location,meeting_url,notes,programme)
  values(p_tenant_id,v_person,v_opportunity,coalesce(v_owner,v_member),v_title,v_kind,v_starts,v_ends,
   v_location,v_meeting,v_notes,v_programme) returning id into v_id;
 else
  update connect.appointments a set person_id=v_person,opportunity_id=v_opportunity,
    owner_membership_id=coalesce(v_owner,a.owner_membership_id),title=v_title,kind=v_kind,
    starts_at=v_starts,ends_at=v_ends,location=v_location,meeting_url=v_meeting,
    notes=v_notes,programme=v_programme,version=a.version+1,updated_at=now()
  where a.id=v_id and a.tenant_id=p_tenant_id and a.status='scheduled'
   and (a.owner_membership_id=v_member or v_role in ('owner','admin','manager'))
   and a.version=(p_data->>'version')::integer;
  if not found then raise exception 'Appointment changed or unavailable' using errcode='40001';end if;
 end if;
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,case when p_data->>'id' is null then 'create_appointment' else 'edit_appointment' end,
 'appointment',v_id,jsonb_build_object('calendar',true));
 return jsonb_build_object('ok',true,'id',v_id);
end $function$
;
revoke all on function public.connect_calendar_list(uuid,uuid) from public,anon,authenticated;
revoke all on function public.connect_calendar_save(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.connect_calendar_list(uuid,uuid) to service_role;
grant execute on function public.connect_calendar_save(uuid,uuid,jsonb) to service_role;
