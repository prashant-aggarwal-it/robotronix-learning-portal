create or replace function saas.claim_academy_email_jobs(p_limit integer default 10)
returns setof saas.academy_email_notification_jobs
language plpgsql security invoker set search_path=saas,pg_temp as $$
begin
 return query
 with due as (
  select j.id from saas.academy_email_notification_jobs j
  where j.status in ('queued','retry') and j.next_attempt_at<=now() and j.attempts<5
  order by j.next_attempt_at,j.created_at
  for update skip locked limit least(greatest(p_limit,1),25)
 )
 update saas.academy_email_notification_jobs j
 set status='sending',attempts=j.attempts+1,locked_at=now(),updated_at=now()
 from due where j.id=due.id
 returning j.*;
end $$;
revoke all on function saas.claim_academy_email_jobs(integer) from public,anon,authenticated;
grant execute on function saas.claim_academy_email_jobs(integer) to service_role;