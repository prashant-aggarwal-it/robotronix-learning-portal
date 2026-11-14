-- DEVELOPMENT-ONLY V2 sample mapping.
-- Run solely in fflejkqcspivnhsmkdtn. Never run in Production.
-- Updates only synthetic tasks whose description begins [DEMO DATA].
begin;
do $seed$
declare demo_owner uuid := 'b4ad0057-b474-4c45-b134-1c46fa3fd64c';
begin
 insert into tasks.areas(owner_user_id,name,color,icon,sort_order)
 select c.owner_user_id,c.name,c.color,c.icon,
  row_number() over(order by c.name)::integer
 from tasks.categories c
 where c.owner_user_id=demo_owner and c.name like '[DEMO] %'
 on conflict do nothing;

 update tasks.items t set area_id=a.id
 from tasks.categories c join tasks.areas a
  on a.owner_user_id=c.owner_user_id and a.name=c.name
 where t.owner_user_id=demo_owner
  and t.category_id=c.id
  and t.description like '[DEMO DATA]%'
  and t.area_id is null;

 insert into tasks.projects(owner_user_id,area_id,name,description)
 select demo_owner,a.id,'[DEMO] School outreach','Test project for partnership calls, demos and proposals.'
 from tasks.areas a
 where a.owner_user_id=demo_owner and a.name='[DEMO] School Partnerships'
 and not exists(select 1 from tasks.projects p where p.owner_user_id=demo_owner and p.name='[DEMO] School outreach');

 insert into tasks.projects(owner_user_id,area_id,name,description)
 select demo_owner,a.id,'[DEMO] Paper Circuit Templates','Test project for design, print alignment and workshops.'
 from tasks.areas a
 where a.owner_user_id=demo_owner and a.name='[DEMO] Curriculum & Classes'
 and not exists(select 1 from tasks.projects p where p.owner_user_id=demo_owner and p.name='[DEMO] Paper Circuit Templates');

 insert into tasks.projects(owner_user_id,area_id,name,description)
 select demo_owner,a.id,'[DEMO] Development UAT','Test project for Portal and CRM acceptance testing.'
 from tasks.areas a
 where a.owner_user_id=demo_owner and a.name='[DEMO] Operations & Finance'
 and not exists(select 1 from tasks.projects p where p.owner_user_id=demo_owner and p.name='[DEMO] Development UAT');

 update tasks.items t set project_id=p.id
 from tasks.projects p
 where t.owner_user_id=demo_owner and t.description like '[DEMO DATA]%'
  and p.owner_user_id=demo_owner and p.name='[DEMO] School outreach'
  and t.area_id=p.area_id and t.project_id is null
  and (lower(t.title) like '%school%' or lower(t.title) like '%preschool%');

 update tasks.items t set project_id=p.id
 from tasks.projects p
 where t.owner_user_id=demo_owner and t.description like '[DEMO DATA]%'
  and p.owner_user_id=demo_owner and p.name='[DEMO] Paper Circuit Templates'
  and t.area_id=p.area_id and t.project_id is null
  and (lower(t.title) like '%circuit%' or lower(t.title) like '%template%');

 update tasks.items t set project_id=p.id
 from tasks.projects p
 where t.owner_user_id=demo_owner and t.description like '[DEMO DATA]%'
  and p.owner_user_id=demo_owner and p.name='[DEMO] Development UAT'
  and t.area_id=p.area_id and t.project_id is null
  and (lower(t.title) like '%portal%' or lower(t.title) like '%task%');
end
$seed$;
commit;
