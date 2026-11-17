-- Phase 4C: enforce default-deny direct API privileges for internal-only tables.
-- These tables have RLS enabled and intentionally have no user-facing RLS policies.
-- Service-role / owner privileges are unaffected.
begin;
revoke all privileges on table public.invoice_sequences, public.system_settings from anon, authenticated;
do $verify$
begin
 if has_table_privilege('anon','public.invoice_sequences','SELECT')
 or has_table_privilege('authenticated','public.invoice_sequences','SELECT')
 or has_table_privilege('authenticated','public.invoice_sequences','INSERT')
 or has_table_privilege('anon','public.system_settings','SELECT')
 or has_table_privilege('authenticated','public.system_settings','SELECT')
 or has_table_privilege('authenticated','public.system_settings','INSERT') then
  raise exception 'Phase 4C private-table privilege hardening failed';
 end if;
end $verify$;
commit;
