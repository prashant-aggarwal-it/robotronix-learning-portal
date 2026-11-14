-- Correct composite FK deletion actions for idea references; Development only.
begin;
alter table tasks.parked_ideas drop constraint parked_source_owner;
alter table tasks.parked_ideas add constraint parked_source_owner foreign key(owner_user_id,source_task_id)
 references tasks.items(owner_user_id,id) on delete set null (source_task_id);
alter table tasks.parked_ideas drop constraint parked_converted_owner;
alter table tasks.parked_ideas add constraint parked_converted_owner foreign key(owner_user_id,converted_task_id)
 references tasks.items(owner_user_id,id) on delete set null (converted_task_id);
commit;
