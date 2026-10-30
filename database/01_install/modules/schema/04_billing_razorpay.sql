-- ============================================================================
-- RAZORPAY + FAMILY BILLING/ADDRESS MODEL
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ RAZORPAY + FAMILY ADDRESS MIGRATION V2
-- File: 12_razorpay_invoice_module_v2.sql
--
-- PURPOSE
--   1) Collect a standard family/contact address for EVERY parent/family.
--   2) Reuse that address as the default billing address.
--   3) Allow a separate billing contact/address if needed.
--   4) Add invoice sequencing + invoice snapshot storage.
--   5) Keep invoice snapshots immutable even if the family later moves.
--
-- IMPORTANT
--   * This migration is additive/idempotent where possible.
--   * It does NOT delete existing data.
--   * It does NOT create Razorpay secrets in the database.
--   * Country/State/City continue to use the portal's API-driven location flow.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. STANDARD FAMILY / PARENT ADDRESS
-- ============================================================
-- This is the normal contact address for all families.
-- It is NOT Razorpay-specific.

CREATE TABLE IF NOT EXISTS public.parent_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,

    address_label text NOT NULL DEFAULT 'Home',
    address_line1 text NOT NULL,
    address_line2 text,
    city text NOT NULL,
    state text,
    postal_code text NOT NULL,
    country text NOT NULL,
    country_code text,

    is_primary boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT parent_addresses_line1_nonempty
        CHECK (length(trim(address_line1)) > 0),
    CONSTRAINT parent_addresses_city_nonempty
        CHECK (length(trim(city)) > 0),
    CONSTRAINT parent_addresses_postal_nonempty
        CHECK (length(trim(postal_code)) > 0),
    CONSTRAINT parent_addresses_country_nonempty
        CHECK (length(trim(country)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_parent_addresses_parent_id
    ON public.parent_addresses(parent_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_primary_address
    ON public.parent_addresses(parent_id)
    WHERE is_primary = true AND is_active = true;


-- ============================================================
-- 2. BILLING PROFILE
-- ============================================================
-- Usually "same as primary guardian + primary address".
-- If another person pays, use separate billing contact/address.

CREATE TABLE IF NOT EXISTS public.parent_billing_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id uuid NOT NULL UNIQUE REFERENCES public.parents(id) ON DELETE CASCADE,

    same_as_primary_guardian boolean NOT NULL DEFAULT true,
    same_as_primary_address boolean NOT NULL DEFAULT true,

    billing_name text,
    billing_email text,
    billing_phone text,

    billing_address_line1 text,
    billing_address_line2 text,
    billing_city text,
    billing_state text,
    billing_postal_code text,
    billing_country text,
    billing_country_code text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_billing_profiles_parent_id
    ON public.parent_billing_profiles(parent_id);


-- ============================================================
-- 3. ONBOARDING FIELDS
-- ============================================================
-- Add standard address + billing-contact preferences to onboarding.
-- Existing country/state/city fields are reused if already present.

ALTER TABLE public.onboarding_submissions
    ADD COLUMN IF NOT EXISTS address_line1 text,
    ADD COLUMN IF NOT EXISTS address_line2 text,
    ADD COLUMN IF NOT EXISTS postal_code text,
    ADD COLUMN IF NOT EXISTS billing_same_as_primary_guardian boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS billing_same_as_primary_address boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS billing_name text,
    ADD COLUMN IF NOT EXISTS billing_email text,
    ADD COLUMN IF NOT EXISTS billing_phone text,
    ADD COLUMN IF NOT EXISTS billing_address_line1 text,
    ADD COLUMN IF NOT EXISTS billing_address_line2 text,
    ADD COLUMN IF NOT EXISTS billing_city text,
    ADD COLUMN IF NOT EXISTS billing_state text,
    ADD COLUMN IF NOT EXISTS billing_postal_code text,
    ADD COLUMN IF NOT EXISTS billing_country text,
    ADD COLUMN IF NOT EXISTS billing_country_code text;


-- ============================================================
-- 4. GUARDIAN SNAPSHOT FIELDS
-- ============================================================
-- Keep the contact/billing data available against the student's guardian record.
-- These are not the canonical family address table; parent_addresses remains canonical.

ALTER TABLE public.student_guardians
    ADD COLUMN IF NOT EXISTS address_line1 text,
    ADD COLUMN IF NOT EXISTS address_line2 text,
    ADD COLUMN IF NOT EXISTS postal_code text,
    ADD COLUMN IF NOT EXISTS billing_same_as_primary_guardian boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS billing_same_as_primary_address boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS billing_name text,
    ADD COLUMN IF NOT EXISTS billing_email text,
    ADD COLUMN IF NOT EXISTS billing_phone text,
    ADD COLUMN IF NOT EXISTS billing_address_line1 text,
    ADD COLUMN IF NOT EXISTS billing_address_line2 text,
    ADD COLUMN IF NOT EXISTS billing_city text,
    ADD COLUMN IF NOT EXISTS billing_state text,
    ADD COLUMN IF NOT EXISTS billing_postal_code text,
    ADD COLUMN IF NOT EXISTS billing_country text,
    ADD COLUMN IF NOT EXISTS billing_country_code text;


-- ============================================================
-- 5. INVOICE SEQUENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_sequences (
    financial_year text PRIMARY KEY,
    last_sequence integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT invoice_sequences_nonnegative CHECK (last_sequence >= 0)
);


-- ============================================================
-- 6. STUDENT INVOICES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    invoice_number text NOT NULL UNIQUE,
    internal_reference text,

    student_id uuid REFERENCES public.students(id) ON DELETE RESTRICT,
    parent_id uuid REFERENCES public.parents(id) ON DELETE RESTRICT,
    enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
    fee_package_id uuid REFERENCES public.student_fee_packages(id) ON DELETE SET NULL,

    -- Razorpay
    razorpay_invoice_id text UNIQUE,
    razorpay_customer_id text,
    razorpay_short_url text,

    -- lifecycle
    status text NOT NULL DEFAULT 'draft',
    issue_date date NOT NULL DEFAULT CURRENT_DATE,
    due_date date NOT NULL,
    paid_at timestamptz,
    cancelled_at timestamptz,

    -- currency / valuation
    currency text NOT NULL,
    foreign_amount numeric(14,3) NOT NULL,
    fx_rate_to_inr numeric(18,6),
    fx_source text,
    fx_fetched_at timestamptz,
    invoice_value_inr numeric(14,2),

    -- tax/export snapshot
    supplier_name text NOT NULL DEFAULT 'Robotronix Tech Lab',
    supplier_gstin text NOT NULL DEFAULT '07AEIPA4473M1ZB',
    sac_code text NOT NULL DEFAULT '999293',
    purpose_code text NOT NULL DEFAULT 'P1107',
    igst_rate numeric(6,3) NOT NULL DEFAULT 0,
    igst_amount numeric(14,2) NOT NULL DEFAULT 0,
    cgst_sgst_applicable boolean NOT NULL DEFAULT false,
    reverse_charge boolean NOT NULL DEFAULT false,
    export_under_lut boolean NOT NULL DEFAULT true,
    export_declaration text NOT NULL DEFAULT
      'SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX',
    place_of_supply text,
    country_of_destination text,

    -- immutable customer snapshot
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    billing_address_line1 text NOT NULL,
    billing_address_line2 text,
    billing_city text NOT NULL,
    billing_state text,
    billing_postal_code text NOT NULL,
    billing_country text NOT NULL,
    billing_country_code text,

    -- service snapshot
    service_title text NOT NULL,
    service_description text,
    session_count integer,
    delivery_mode text,
    terms_text text,

    -- Razorpay / audit snapshots
    razorpay_payload jsonb,
    razorpay_response jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT student_invoices_status_check
      CHECK (status IN (
        'draft',
        'reviewed',
        'issued',
        'partially_paid',
        'paid',
        'expired',
        'cancelled',
        'failed'
      )),
    CONSTRAINT student_invoices_foreign_amount_positive
      CHECK (foreign_amount > 0),
    CONSTRAINT student_invoices_due_after_issue
      CHECK (due_date >= issue_date)
);

CREATE INDEX IF NOT EXISTS idx_student_invoices_student_id
    ON public.student_invoices(student_id);

CREATE INDEX IF NOT EXISTS idx_student_invoices_parent_id
    ON public.student_invoices(parent_id);

CREATE INDEX IF NOT EXISTS idx_student_invoices_enrollment_id
    ON public.student_invoices(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_student_invoices_status
    ON public.student_invoices(status);

CREATE INDEX IF NOT EXISTS idx_student_invoices_issue_date
    ON public.student_invoices(issue_date);


-- ============================================================
-- 7. INVOICE NUMBER GENERATOR
-- ============================================================
-- Format: RTX/26-27/0001
-- Financial year follows Indian FY: Apr-Mar.
-- Sequence is never reused.

CREATE OR REPLACE FUNCTION public.next_robotronix_invoice_number(
    p_issue_date date DEFAULT CURRENT_DATE
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_start_year integer;
    v_end_year integer;
    v_fy text;
    v_seq integer;
BEGIN
    IF EXTRACT(MONTH FROM p_issue_date) >= 4 THEN
        v_start_year := EXTRACT(YEAR FROM p_issue_date)::integer;
    ELSE
        v_start_year := EXTRACT(YEAR FROM p_issue_date)::integer - 1;
    END IF;

    v_end_year := v_start_year + 1;

    v_fy :=
        right(v_start_year::text, 2)
        || '-'
        || right(v_end_year::text, 2);

    INSERT INTO public.invoice_sequences(financial_year, last_sequence)
    VALUES (v_fy, 1)
    ON CONFLICT (financial_year)
    DO UPDATE SET
        last_sequence = public.invoice_sequences.last_sequence + 1,
        updated_at = now()
    RETURNING last_sequence INTO v_seq;

    RETURN 'RTX/' || v_fy || '/' || lpad(v_seq::text, 4, '0');
END;
$$;


-- ============================================================
-- SHARED SYSTEM SETTINGS TABLE
-- Consolidated from 04_operations_final_v2.sql.
-- Must exist before invoice/enrollment/community settings are seeded.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value_text TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. SYSTEM SETTINGS FOR INVOICING
-- ============================================================
-- Store non-secret application behaviour here.
-- Razorpay Key ID/Secret/Webhook Secret remain in environment variables.

INSERT INTO public.system_settings(key, value_text, description)
VALUES
    ('invoice_provider', 'razorpay', 'Invoice provider for international parent invoices'),
    ('invoice_scope', 'international_only', 'Razorpay invoicing is used for international parents only'),
    ('invoice_default_due_days', '2', 'Default invoice due date offset in days'),
    ('invoice_admin_review_required', 'true', 'Admin must review invoice before Razorpay creation/sending'),
    ('invoice_auto_send', 'false', 'Do not automatically send Razorpay invoices'),
    ('invoice_default_sac', '999293', 'Default SAC code for Robotronix training services'),
    ('invoice_default_purpose_code', 'P1107', 'Default purpose code used for export service invoices'),
    ('invoice_export_under_lut', 'true', 'Export invoices are issued under LUT without payment of IGST'),
    ('invoice_export_igst_rate', '0', 'Default IGST rate for eligible export-under-LUT invoices'),
    ('invoice_number_prefix', 'RTX', 'Robotronix invoice number prefix')
ON CONFLICT (key)
DO UPDATE SET
    value_text = EXCLUDED.value_text,
    description = EXCLUDED.description,
    updated_at = NOW();


-- ============================================================
-- 9. PROTECT ISSUED/PAID INVOICES FROM DELETE
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_student_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
    IF OLD.status IN ('issued','partially_paid','paid','expired','cancelled') THEN
        RAISE EXCEPTION
          'Issued financial records must not be deleted. Cancel/retain the invoice instead.';
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_student_invoice_delete_trg
ON public.student_invoices;

CREATE TRIGGER guard_student_invoice_delete_trg
BEFORE DELETE ON public.student_invoices
FOR EACH ROW
EXECUTE FUNCTION public.guard_student_invoice_delete();


COMMIT;


-- ============================================================
-- QUICK VERIFICATION
-- ============================================================

SELECT
    to_regclass('public.parent_addresses') AS parent_addresses,
    to_regclass('public.parent_billing_profiles') AS parent_billing_profiles,
    to_regclass('public.invoice_sequences') AS invoice_sequences,
    to_regclass('public.student_invoices') AS student_invoices;

SELECT
    key,
    value_text,
    description
FROM public.system_settings
WHERE key LIKE 'invoice_%'
ORDER BY key;

SELECT public.next_robotronix_invoice_number(CURRENT_DATE) AS sample_invoice_number;
-- IMPORTANT:
-- The sample call above CONSUMES one invoice sequence number.
-- If you do not want that during verification, comment it out before running.


-- ============================================================================
-- RAZORPAY PORTAL COMPATIBILITY
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ RAZORPAY V2 PORTAL COMPATIBILITY MIGRATION
-- File: 14_razorpay_v2_portal_compatibility.sql
--
-- Run AFTER 12_razorpay_invoice_module_v2_FIXED.sql.
-- This aligns the V2 invoice schema with the portal runtime fields needed
-- for Razorpay status/payment tracking while keeping V2 as canonical.
-- Additive only; no invoice or family data is deleted.
-- ============================================================

BEGIN;

-- Extra immutable supplier/audit/lifecycle fields required by the portal.
ALTER TABLE public.student_invoices
  ADD COLUMN IF NOT EXISTS razorpay_invoice_number text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_due numeric(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_address text NOT NULL DEFAULT 'F-184/D, Aggarwals Paliwal Dharamshala Marg, Laxmi Nagar, East Delhi, Delhi 110092, India',
  ADD COLUMN IF NOT EXISTS supplier_email text NOT NULL DEFAULT 'robotronixstemlab@gmail.com',
  ADD COLUMN IF NOT EXISTS supplier_phone text NOT NULL DEFAULT '+918595772008',
  ADD COLUMN IF NOT EXISTS export_eligibility_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Ensure amount_due is sensible for any existing rows created before this patch.
UPDATE public.student_invoices
SET amount_due = CASE
  WHEN status = 'paid' THEN 0
  WHEN amount_due = 0 THEN foreign_amount
  ELSE amount_due
END
WHERE foreign_amount IS NOT NULL;

-- V2 billing profile is intentionally separate from normal family address.
-- Keep one profile per parent and allow the portal to read/write it securely.
ALTER TABLE public.parent_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parent_billing_admin_read ON public.parent_billing_profiles;
CREATE POLICY parent_billing_admin_read ON public.parent_billing_profiles
FOR SELECT TO authenticated USING(public.is_admin());

DROP POLICY IF EXISTS parent_billing_parent_read ON public.parent_billing_profiles;
CREATE POLICY parent_billing_parent_read ON public.parent_billing_profiles
FOR SELECT TO authenticated USING(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS parent_billing_parent_write ON public.parent_billing_profiles;
CREATE POLICY parent_billing_parent_write ON public.parent_billing_profiles
FOR ALL TO authenticated
USING(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
)
WITH CHECK(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS parent_address_admin_read ON public.parent_addresses;
CREATE POLICY parent_address_admin_read ON public.parent_addresses
FOR SELECT TO authenticated USING(public.is_admin());

DROP POLICY IF EXISTS parent_address_parent_read ON public.parent_addresses;
CREATE POLICY parent_address_parent_read ON public.parent_addresses
FOR SELECT TO authenticated USING(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS parent_address_parent_write ON public.parent_addresses;
CREATE POLICY parent_address_parent_write ON public.parent_addresses
FOR ALL TO authenticated
USING(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
)
WITH CHECK(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS invoices_admin_read ON public.student_invoices;
CREATE POLICY invoices_admin_read ON public.student_invoices
FOR SELECT TO authenticated USING(public.is_admin());

drop policy if exists invoices_parent_read on public.student_invoices;
create policy invoices_parent_read on public.student_invoices for select to authenticated using(
 status not in ('draft','reviewed') and exists(
 select 1 from public.parent_students ps join public.parents pa on pa.id=ps.parent_id
 where ps.student_id=student_invoices.student_id and pa.profile_id=(select auth.uid()))
);
-- Server/service-role API performs invoice insert/update actions.

COMMIT;

-- Verification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='student_invoices'
  AND column_name IN (
    'fee_package_id','foreign_amount','fx_rate_to_inr','fx_source',
    'amount_paid','amount_due','razorpay_invoice_number','razorpay_payment_id',
    'supplier_address','supplier_email','supplier_phone',
    'export_eligibility_confirmed','admin_reviewed_at','admin_reviewed_by'
  )
ORDER BY column_name;


-- ============================================================================
-- ENROLLMENT / NOTIFICATION / AUTH SUPPORT
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ FUNCTIONAL + DATA MODEL MIGRATION
-- File: 16_v1_2_0_enrollment_notification_auth_support.sql
--
-- Covers:
--   * fixed / short-package / open-ended enrollment models
--   * planned session limits and paid-session balance
--   * auto-completion for fixed programs
--   * safer scheduling support
--   * notification dedupe for class schedule changes
--   * parent onboarding lookup performance
--
-- This migration is additive and preserves existing master data.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Flexible enrollment lifecycle
-- ------------------------------------------------------------

ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS program_model text NOT NULL DEFAULT 'fixed_program',
    ADD COLUMN IF NOT EXISTS planned_sessions integer,
    ADD COLUMN IF NOT EXISTS paid_session_balance integer,
    ADD COLUMN IF NOT EXISTS planned_end_date date,
    ADD COLUMN IF NOT EXISTS auto_complete_on_session_limit boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='enrollments_program_model_check'
      AND conrelid='public.enrollments'::regclass
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_program_model_check
      CHECK (program_model IN ('fixed_program','short_package','open_ended'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='enrollments_planned_sessions_check'
      AND conrelid='public.enrollments'::regclass
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_planned_sessions_check
      CHECK (planned_sessions IS NULL OR planned_sessions > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='enrollments_paid_session_balance_check'
      AND conrelid='public.enrollments'::regclass
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_paid_session_balance_check
      CHECK (paid_session_balance IS NULL OR paid_session_balance >= 0);
  END IF;
END $$;

-- Existing enrollments use the course session count as their fixed-program target.
UPDATE public.enrollments e
SET planned_sessions = c.total_sessions
FROM public.courses c
WHERE e.course_id=c.id
  AND e.program_model='fixed_program'
  AND e.planned_sessions IS NULL
  AND c.total_sessions IS NOT NULL
  AND c.total_sessions > 0;

-- ------------------------------------------------------------
-- 2. Progress + automatic fixed-program completion
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_enrollment_progress(p_enrollment uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_count int;
  v_target int;
  v_model text;
  v_auto boolean;
  v_status text;
BEGIN
  SELECT coalesce(e.opening_completed_sessions,0) + count(a.*)
    INTO v_count
  FROM public.enrollments e
  LEFT JOIN public.class_attendance a ON a.enrollment_id=e.id AND a.status IN ('attended','late')
  WHERE e.id=p_enrollment
  GROUP BY e.opening_completed_sessions;

  SELECT
      e.program_model,
      e.auto_complete_on_session_limit,
      e.status,
      CASE
        WHEN e.planned_sessions IS NOT NULL THEN e.planned_sessions
        WHEN e.program_model='fixed_program' THEN c.total_sessions
        ELSE NULL
      END
  INTO v_model, v_auto, v_status, v_target
  FROM public.enrollments e
  JOIN public.courses c ON c.id=e.course_id
  WHERE e.id=p_enrollment;

  UPDATE public.enrollments
  SET
      sessions_completed=coalesce(v_count,0),
      progress_percent=CASE
        WHEN coalesce(v_target,0)>0
          THEN least(100,round((v_count::numeric/v_target::numeric)*100,2))
        ELSE 0
      END,
      status=CASE
        WHEN v_model='fixed_program'
             AND coalesce(v_auto,true)
             AND coalesce(v_target,0)>0
             AND coalesce(v_count,0)>=v_target
             AND v_status='active'
          THEN 'completed'
        ELSE status
      END,
      completed_at=CASE
        WHEN v_model='fixed_program'
             AND coalesce(v_auto,true)
             AND coalesce(v_target,0)>0
             AND coalesce(v_count,0)>=v_target
             AND v_status='active'
          THEN coalesce(completed_at,current_date)
        ELSE completed_at
      END,
      updated_at=now()
  WHERE id=p_enrollment;
END $$;

-- ------------------------------------------------------------
-- 3. Parent onboarding lookup/index for multi-child family flow
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS onboarding_submissions_user_status_idx
ON public.onboarding_submissions(user_id,status,submitted_at DESC);

-- ------------------------------------------------------------
-- 4. Notification dedupe / correct learner scoping
-- ------------------------------------------------------------

ALTER TABLE public.portal_notifications
    ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS portal_notifications_dedupe_uidx
ON public.portal_notifications(dedupe_key)
WHERE dedupe_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_schedule_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  event_type text;
  title_text text;
  msg text;
  sid uuid;
  event_id uuid;
BEGIN
  event_id:=new.id;

  IF tg_op='INSERT' THEN
    event_type:='class_scheduled';
    title_text:='Class scheduled';
    msg:='A learning session has been scheduled.';
  ELSIF new.status='cancelled' AND old.status IS DISTINCT FROM new.status THEN
    event_type:='class_cancelled';
    title_text:='Class cancelled';
    msg:='A scheduled learning session has been cancelled.';
  ELSIF new.status='rescheduled'
        OR new.date IS DISTINCT FROM old.date
        OR new.start_time IS DISTINCT FROM old.start_time
        OR new.end_time IS DISTINCT FROM old.end_time THEN
    event_type:='class_rescheduled';
    title_text:='Class schedule updated';
    msg:='A learning session has a revised date or time.';
  ELSE
    RETURN new;
  END IF;

  -- Resolve all learners belonging to this occurrence.
  FOR sid IN
    SELECT DISTINCT x.student_id
    FROM (
      SELECT new.student_id AS student_id
      WHERE new.student_id IS NOT NULL

      UNION ALL

      SELECT e.student_id
      FROM public.enrollments e
      WHERE new.enrollment_id IS NOT NULL
        AND e.id=new.enrollment_id

      UNION ALL

      SELECT e.student_id
      FROM public.enrollments e
      WHERE new.cohort_id IS NOT NULL
        AND e.cohort_id=new.cohort_id
        AND e.status='active'
    ) x
    WHERE x.student_id IS NOT NULL
  LOOP
    INSERT INTO public.portal_notifications
      (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
    VALUES
      ('parent',sid,new.trainer_id,event_type,'action',title_text,msg,'/parent',
       event_id::text||':'||event_type||':parent:'||sid::text)
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
    DO NOTHING;

    INSERT INTO public.portal_notifications
      (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
    VALUES
      ('student',sid,new.trainer_id,event_type,'info',title_text,msg,'/student',
       event_id::text||':'||event_type||':student:'||sid::text)
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
    DO NOTHING;
  END LOOP;

  INSERT INTO public.portal_notifications
    (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  VALUES
    ('trainer',new.student_id,new.trainer_id,event_type,'info',title_text,msg,'/trainer/schedule',
     event_id::text||':'||event_type||':trainer:'||new.trainer_id::text)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
  DO NOTHING;

  RETURN new;
END $$;

-- ------------------------------------------------------------
-- 5. Non-secret operational settings
-- ------------------------------------------------------------

INSERT INTO public.system_settings(key,value_text,description)
VALUES
  ('enrollment_completion_warning_sessions','4','Warn Admin when a fixed program is approaching completion'),
  ('open_ended_require_paid_balance','true','Open-ended/short-package scheduling is blocked when an explicit paid-session balance reaches zero')
ON CONFLICT(key)
DO UPDATE SET
  value_text=EXCLUDED.value_text,
  description=EXCLUDED.description,
  updated_at=now();

COMMIT;

-- Quick verification
SELECT
  column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='enrollments'
  AND column_name IN (
    'program_model','planned_sessions','paid_session_balance',
    'planned_end_date','auto_complete_on_session_limit'
  )
ORDER BY column_name;

SELECT key,value_text
FROM public.system_settings
WHERE key IN ('enrollment_completion_warning_sessions','open_ended_require_paid_balance')
ORDER BY key;


