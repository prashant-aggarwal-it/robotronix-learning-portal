-- DEV Phase 7B: new invitation attempts are sent through Hostinger SMTP.
-- Preserve existing historical provider labels and delivery audit records.
begin;
alter table saas.customer_invitation_deliveries
  alter column provider set default 'hostinger_smtp';
commit;
