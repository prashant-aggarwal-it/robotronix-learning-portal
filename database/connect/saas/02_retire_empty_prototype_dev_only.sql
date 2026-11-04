-- DEVELOPMENT ONLY: remove obsolete empty prototype crm_* tables.
-- The replacement standalone Connect SaaS schema is connect.*.
-- Strict safety: abort if any prototype table has data, if count != 28,
-- or if any dependent external object would require CASCADE.
begin;
do $cleanup$
declare r record; n bigint; num integer; tables_csv text;
begin
 select count(*),string_agg(format('%I.%I',schemaname,tablename),', ' order by tablename)
 into num,tables_csv from pg_tables
 where schemaname='public' and tablename like 'crm_%';
 if num <> 28 then raise exception 'Expected exactly 28 prototype CRM tables; found %',num; end if;
 for r in select schemaname,tablename from pg_tables
          where schemaname='public' and tablename like 'crm_%' loop
  execute format('select count(*) from %I.%I',r.schemaname,r.tablename) into n;
  if n <> 0 then raise exception 'Refusing cleanup; %.% has % rows',r.schemaname,r.tablename,n; end if;
 end loop;
 execute 'drop table '||tables_csv||' restrict';
end
$cleanup$;
commit;
