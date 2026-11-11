-- Refine the empty standalone DEV schema to match the canonical fresh install.
begin;
do $preflight$
begin
 if exists(select 1 from connect.people limit 1) or exists(select 1 from connect.opportunities limit 1)
 or exists(select 1 from connect.stage_events limit 1) then
  raise exception 'Refusing empty-schema refinement because business rows exist';
 end if;
end $preflight$;
alter table connect.people drop column kind;
create table connect.person_roles (
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 person_id uuid not null,
 role text not null check(role in ('learner','guardian','staff','customer','contact','other')),
 primary key(tenant_id,person_id,role),
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict
);
alter table connect.person_roles enable row level security;
revoke all on connect.person_roles from public,anon,authenticated;
grant select,insert,update,delete on connect.person_roles to service_role;
alter table connect.opportunities drop column state;
alter table connect.opportunities add constraint connect_opportunities_pipeline_unique unique(tenant_id,pipeline_id,id);
alter table connect.stage_events add column pipeline_id uuid not null;
alter table connect.stage_events drop constraint stage_events_tenant_id_opportunity_id_fkey;
alter table connect.stage_events drop constraint stage_events_tenant_id_from_stage_id_fkey;
alter table connect.stage_events drop constraint stage_events_tenant_id_to_stage_id_fkey;
alter table connect.stage_events add constraint connect_stage_event_opportunity_fkey foreign key(tenant_id,pipeline_id,opportunity_id) references connect.opportunities(tenant_id,pipeline_id,id) on delete restrict;
alter table connect.stage_events add constraint connect_stage_event_from_stage_fkey foreign key(tenant_id,pipeline_id,from_stage_id) references connect.pipeline_stages(tenant_id,pipeline_id,id) on delete restrict;
alter table connect.stage_events add constraint connect_stage_event_to_stage_fkey foreign key(tenant_id,pipeline_id,to_stage_id) references connect.pipeline_stages(tenant_id,pipeline_id,id) on delete restrict;
commit;
