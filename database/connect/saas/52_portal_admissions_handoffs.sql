-- Phase C — accepted offers and verifiable parent-owned onboarding handoff.
create table if not exists connect.portal_admission_handoffs (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 opportunity_id uuid not null,
 learner_person_id uuid not null,
 request_id uuid not null,
 payload_hash text not null,
 token_hash text not null unique,
 token_expires_at timestamptz not null,
 offer_snapshot jsonb not null,
 acceptance_recorded_at timestamptz not null default now(),
 acceptance_recorded_by uuid not null references auth.users(id),
 guardian_consent_attested boolean not null default false,
 status text not null default 'invited' check(status in ('invited','onboarding_pending','review_required','enrollment_confirmed','revoked')),
 onboarding_submission_id uuid,
 portal_enrollment_id uuid,
 portal_student_id uuid,
 verified_at timestamptz,
 verified_by uuid,
 confirmed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,request_id),
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,learner_person_id) references connect.people(tenant_id,id) on delete restrict,
 check(jsonb_typeof(offer_snapshot)='object')
);
create unique index if not exists connect_handoff_submission_unique on connect.portal_admission_handoffs(onboarding_submission_id) where onboarding_submission_id is not null;
create unique index if not exists connect_handoff_enrollment_unique on connect.portal_admission_handoffs(portal_enrollment_id) where portal_enrollment_id is not null;
create unique index if not exists connect_handoff_one_active_offer on connect.portal_admission_handoffs(tenant_id,opportunity_id) where status<>'revoked';
create index if not exists connect_handoff_opportunity_idx on connect.portal_admission_handoffs(tenant_id,opportunity_id,created_at desc);
alter table connect.portal_admission_handoffs enable row level security;
revoke all on connect.portal_admission_handoffs from public,anon,authenticated;
grant select,insert,update on connect.portal_admission_handoffs to service_role;

-- A connected CRM opportunity cannot be prematurely marked Won by dragging a card.
create or replace function connect.guard_portal_enrollment_won() returns trigger
language plpgsql security invoker set search_path='' as $fn$
begin
 if new.stage_id is distinct from old.stage_id and exists(
  select 1 from connect.portal_demo_integrations i where i.tenant_id=new.tenant_id and i.status='active'
 ) and exists(select 1 from connect.pipeline_stages s where s.tenant_id=new.tenant_id and s.id=new.stage_id and s.outcome='won')
 and not exists(select 1 from connect.portal_admission_handoffs h where h.tenant_id=new.tenant_id
  and h.opportunity_id=new.id and h.status='enrollment_confirmed' and h.portal_enrollment_id is not null)
 then raise exception 'Portal enrollment confirmation required before Won' using errcode='23514';end if;
 return new;
end $fn$;
drop trigger if exists guard_portal_enrollment_won on connect.opportunities;
create trigger guard_portal_enrollment_won before update on connect.opportunities
for each row execute function connect.guard_portal_enrollment_won();
revoke all on function connect.guard_portal_enrollment_won() from public,anon,authenticated;
