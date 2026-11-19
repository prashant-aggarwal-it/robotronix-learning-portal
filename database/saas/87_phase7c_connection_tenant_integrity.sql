begin;
create unique index if not exists academy_email_connection_id_org_idx on saas.academy_email_connections(id,organization_id);
alter table saas.academy_email_delivery_events
 add constraint academy_email_delivery_connection_same_tenant_fk
 foreign key (connection_id,organization_id)
 references saas.academy_email_connections(id,organization_id);
commit;
