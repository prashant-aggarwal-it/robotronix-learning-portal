-- Robotronix Learning Portal — Razorpay Operations hardening
-- Additive production upgrade for webhook reliability, reconciliation and invoice operations.

begin;

alter table public.student_invoices add column if not exists last_synced_at timestamptz;
alter table public.student_invoices add column if not exists sync_error text;

-- One fee package must map to at most one Robotronix invoice.
create unique index if not exists student_invoices_fee_package_unique
  on public.student_invoices(fee_package_id)
  where fee_package_id is not null;

create table if not exists public.razorpay_webhook_events (
  event_key text primary key,
  event_type text not null,
  razorpay_event_id text,
  razorpay_invoice_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempt_count integer not null default 1,
  processing_error text
);

create index if not exists razorpay_webhook_events_invoice_idx
  on public.razorpay_webhook_events(razorpay_invoice_id, received_at desc);

alter table public.razorpay_webhook_events enable row level security;
grant all on table public.razorpay_webhook_events to service_role;

notify pgrst, 'reload schema';
commit;
