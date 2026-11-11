-- Keep imported contact tags/city/company available to contact segments after every future import.
create or replace function connect.contact_import_enrich_profile()
returns trigger language plpgsql set search_path to '' as $fn$
begin
 insert into connect.contact_profiles(tenant_id,person_id,company,city,notes,tags)
 values(new.tenant_id,new.person_id,new.company,new.city,new.notes,coalesce(new.tags,'{}'::text[]))
 on conflict(tenant_id,person_id) do update
 set company=coalesce(connect.contact_profiles.company,excluded.company),
 city=coalesce(connect.contact_profiles.city,excluded.city),
 notes=coalesce(connect.contact_profiles.notes,excluded.notes),
 tags=array(select distinct tag from unnest(coalesce(connect.contact_profiles.tags,'{}'::text[])||excluded.tags) tag limit 20),
 updated_at=now();
 return new;
end $fn$;
revoke all on function connect.contact_import_enrich_profile() from public,anon,authenticated;
drop trigger if exists contact_import_enrich_profile on connect.contact_import_details;
create trigger contact_import_enrich_profile
 after insert on connect.contact_import_details
 for each row execute function connect.contact_import_enrich_profile();
