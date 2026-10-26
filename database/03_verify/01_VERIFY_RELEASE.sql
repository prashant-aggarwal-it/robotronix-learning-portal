-- Robotronix™ Learning Portal — Production v1.0.0
-- Generated consolidated release file. Fresh-install oriented; historical patch files are intentionally omitted.


-- ============================================================================
-- CORE FINAL VERIFICATION
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ FINAL DATABASE VERIFICATION
-- File: 07_final_verification.sql
--
-- READ-ONLY verification script.
-- Intended after:
--   01_reference_final_v2.sql
--   02_academic_final_v2.sql
--   03_people_access_final_v2.sql
--   04_operations_final_v2.sql
--   05_finance_payroll_final_v2.sql
--   06_system_notifications_final_v3.sql
--
-- This script DOES NOT modify data.
-- ============================================================


-- A. REQUIRED TABLES
WITH required_tables(table_name) AS (
    VALUES
        ('countries'), ('currencies'), ('timezones'),
        ('academic_levels'), ('course_academic_levels'), ('courses'),
        ('profiles'), ('portal_access_requests'),
        ('cohorts'), ('enrollments'), ('schedule_events'),
        ('class_attendance'), ('session_records'), ('enrollment_holds'), ('learning_observation_internal_notes'),
        ('student_fee_packages'), ('student_fee_payments'),
        ('trainer_earnings'), ('trainer_finance'), ('trainer_payouts'),
        ('communication_messages'), ('portal_notifications'),
        ('reminder_policies'), ('system_settings')
)
SELECT
    'A_REQUIRED_TABLES' AS section,
    r.table_name,
    CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS result
FROM required_tables r
LEFT JOIN information_schema.tables t
  ON t.table_schema='public' AND t.table_name=r.table_name
ORDER BY r.table_name;


-- B. REFERENCE DATA
SELECT
    'B_REFERENCE_SUMMARY' AS section,
    (SELECT COUNT(*) FROM public.countries) AS countries,
    (SELECT COUNT(*) FROM public.currencies) AS currencies,
    (SELECT COUNT(*) FROM public.currencies WHERE is_active=TRUE) AS active_currencies,
    (SELECT COUNT(*) FROM public.timezones) AS timezones;

SELECT
    'B_ACTIVE_CURRENCIES' AS section,
    code, name, symbol, decimal_digits
FROM public.currencies
WHERE is_active=TRUE
ORDER BY code;


-- C. ACADEMIC
SELECT
    'C_ACADEMIC_LEVEL_COUNT' AS section,
    COUNT(*) AS academic_level_count,
    CASE WHEN COUNT(*)=19 THEN 'OK' ELSE 'CHECK' END AS result
FROM public.academic_levels;

SELECT
    'C_COURSE_LEVEL_MAPPING' AS section,
    c.code AS course_code,
    c.title AS course_title,
    c.grade_from,
    c.grade_to,
    a.code AS academic_level_code,
    a.name AS academic_level
FROM public.course_academic_levels cal
JOIN public.courses c ON c.id=cal.course_id
JOIN public.academic_levels a ON a.id=cal.academic_level_id
ORDER BY c.title, a.sort_order;

WITH expected AS (
    SELECT c.id course_id, c.code course_code,
           a.id academic_level_id, a.code academic_level_code
    FROM public.courses c
    JOIN public.academic_levels a
      ON a.grade_number BETWEEN c.grade_from AND c.grade_to
    WHERE a.grade_number IS NOT NULL
      AND c.grade_from BETWEEN 1 AND 12
      AND c.grade_to BETWEEN 1 AND 12
      AND c.grade_from <= c.grade_to
)
SELECT
    'C_MAPPING_GAPS_EXPECT_ZERO_ROWS' AS section,
    e.course_code,
    e.academic_level_code
FROM expected e
LEFT JOIN public.course_academic_levels cal
  ON cal.course_id=e.course_id
 AND cal.academic_level_id=e.academic_level_id
WHERE cal.course_id IS NULL
ORDER BY e.course_code, e.academic_level_code;


-- D. PEOPLE / ACCESS
SELECT 'D_PROFILE_ROLES' AS section, role, COUNT(*) AS rows
FROM public.profiles
GROUP BY role
ORDER BY role;

SELECT 'D_PORTAL_ACCESS' AS section, target_type, status, COUNT(*) AS rows
FROM public.portal_access_requests
GROUP BY target_type, status
ORDER BY target_type, status;

SELECT 'D_INVALID_PROFILE_ROLES_EXPECT_ZERO_ROWS' AS section, id, role
FROM public.profiles
WHERE role NOT IN ('admin','trainer','parent','student');

SELECT 'D_INVALID_ACCESS_STATUS_EXPECT_ZERO_ROWS' AS section,
       target_type, target_id, status
FROM public.portal_access_requests
WHERE status NOT IN ('invited','linked','disabled');


-- E. OPERATIONS
SELECT 'E_OPERATIONS_VALUES' AS section, 'cohorts.status' AS field, status AS value, COUNT(*) AS rows
FROM public.cohorts GROUP BY status
UNION ALL
SELECT 'E_OPERATIONS_VALUES','enrollments.status',status,COUNT(*) FROM public.enrollments GROUP BY status
UNION ALL
SELECT 'E_OPERATIONS_VALUES','enrollments.enrollment_type',enrollment_type,COUNT(*) FROM public.enrollments GROUP BY enrollment_type
UNION ALL
SELECT 'E_OPERATIONS_VALUES','enrollments.delivery_channel',delivery_channel,COUNT(*) FROM public.enrollments GROUP BY delivery_channel
UNION ALL
SELECT 'E_OPERATIONS_VALUES','enrollments.schedule_mode',schedule_mode,COUNT(*) FROM public.enrollments GROUP BY schedule_mode
UNION ALL
SELECT 'E_OPERATIONS_VALUES','schedule_events.status',status,COUNT(*) FROM public.schedule_events GROUP BY status
UNION ALL
SELECT 'E_OPERATIONS_VALUES','schedule_events.event_type',event_type,COUNT(*) FROM public.schedule_events GROUP BY event_type
UNION ALL
SELECT 'E_OPERATIONS_VALUES','schedule_events.delivery_mode',delivery_mode,COUNT(*) FROM public.schedule_events GROUP BY delivery_mode
UNION ALL
SELECT 'E_OPERATIONS_VALUES','schedule_events.occurrence_kind',occurrence_kind,COUNT(*) FROM public.schedule_events GROUP BY occurrence_kind
UNION ALL
SELECT 'E_OPERATIONS_VALUES','class_attendance.status',status,COUNT(*) FROM public.class_attendance GROUP BY status
UNION ALL
SELECT 'E_OPERATIONS_VALUES','session_records.attendance',attendance,COUNT(*) FROM public.session_records GROUP BY attendance
UNION ALL
SELECT 'E_OPERATIONS_VALUES','enrollment_holds.status',status,COUNT(*) FROM public.enrollment_holds GROUP BY status
ORDER BY field, value;


-- F. SYSTEM SETTINGS
SELECT
    'F_SYSTEM_SETTINGS' AS section,
    key,
    value_text
FROM public.system_settings
ORDER BY key;

WITH expected(key, expected_value) AS (
    VALUES
        ('default_timezone','Asia/Kolkata'),
        ('default_currency','INR'),
        ('schedule_interval_minutes','30'),
        ('schedule_day_start','08:00'),
        ('schedule_day_end','23:00'),
        ('default_class_duration_minutes','60'),
        ('allow_cross_midnight_availability','true'),
        ('default_page_size','25'),
        ('date_display_format','DD MMM YYYY'),
        ('time_display_format','12-hour'),
        ('organisation_name','Robotronix™'),
        ('organisation_website','https://www.robotronixstemlab.com'),
        ('portal_url','https://portal.robotronixstemlab.com'),
        ('notification_default_priority','info'),
        ('message_max_length','4000'),
        ('class_reminders_enabled','true'),
        ('attendance_reminders_enabled','true')
)
SELECT
    'F_SETTINGS_CHECK' AS section,
    e.key,
    e.expected_value,
    s.value_text AS actual_value,
    CASE
        WHEN s.key IS NULL THEN 'MISSING'
        WHEN s.value_text=e.expected_value THEN 'OK'
        ELSE 'DIFFERENT'
    END AS result
FROM expected e
LEFT JOIN public.system_settings s ON s.key=e.key
ORDER BY e.key;

-- Contact details MUST be populated for production.
SELECT
    'F_SUPPORT_CONTACTS' AS section,
    key,
    value_text,
    CASE
        WHEN COALESCE(TRIM(value_text),'')='' THEN 'ERROR - BLANK'
        WHEN value_text IN ('YOUR_SUPPORT_EMAIL_HERE','YOUR_SUPPORT_PHONE_HERE')
            THEN 'ERROR - PLACEHOLDER'
        ELSE 'OK'
    END AS result
FROM public.system_settings
WHERE key IN ('support_email','support_phone')
ORDER BY key;


-- G. FINANCE / PAYROLL
SELECT 'G_FINANCE_VALUES' AS section, 'student_fee_packages.scheme' AS field, scheme AS value, COUNT(*) AS rows
FROM public.student_fee_packages GROUP BY scheme
UNION ALL
SELECT 'G_FINANCE_VALUES','student_fee_packages.currency',currency,COUNT(*) FROM public.student_fee_packages GROUP BY currency
UNION ALL
SELECT 'G_FINANCE_VALUES','student_fee_payments.method',method,COUNT(*) FROM public.student_fee_payments GROUP BY method
UNION ALL
SELECT 'G_FINANCE_VALUES','student_fee_payments.kind',kind,COUNT(*) FROM public.student_fee_payments GROUP BY kind
UNION ALL
SELECT 'G_FINANCE_VALUES','trainer_earnings.session_type',session_type,COUNT(*) FROM public.trainer_earnings GROUP BY session_type
UNION ALL
SELECT 'G_FINANCE_VALUES','trainer_earnings.pay_band',pay_band,COUNT(*) FROM public.trainer_earnings GROUP BY pay_band
UNION ALL
SELECT 'G_FINANCE_VALUES','trainer_earnings.class_outcome',class_outcome,COUNT(*) FROM public.trainer_earnings GROUP BY class_outcome
UNION ALL
SELECT 'G_FINANCE_VALUES','trainer_earnings.status',status,COUNT(*) FROM public.trainer_earnings GROUP BY status
UNION ALL
SELECT 'G_FINANCE_VALUES','trainer_finance.preferred_payout_method',preferred_payout_method,COUNT(*) FROM public.trainer_finance GROUP BY preferred_payout_method
UNION ALL
SELECT 'G_FINANCE_VALUES','trainer_finance.payment_model',payment_model,COUNT(*) FROM public.trainer_finance GROUP BY payment_model
UNION ALL
SELECT 'G_FINANCE_VALUES','trainer_finance.compliance_status',compliance_status,COUNT(*) FROM public.trainer_finance GROUP BY compliance_status
UNION ALL
SELECT 'G_FINANCE_VALUES','trainer_payouts.status',status,COUNT(*) FROM public.trainer_payouts GROUP BY status
ORDER BY field, value;

SELECT
    'G_CURRENCY_CONSTRAINT' AS section,
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid='public.student_fee_packages'::regclass
  AND conname='student_fee_packages_currency_check';


-- H. NOTIFICATIONS / COMMUNICATIONS
SELECT 'H_NOTIFICATION_VALUES' AS section, 'communication_messages.sender_role' AS field, sender_role AS value, COUNT(*) AS rows
FROM public.communication_messages GROUP BY sender_role
UNION ALL
SELECT 'H_NOTIFICATION_VALUES','portal_notifications.recipient_role',recipient_role,COUNT(*) FROM public.portal_notifications GROUP BY recipient_role
UNION ALL
SELECT 'H_NOTIFICATION_VALUES','portal_notifications.type',type,COUNT(*) FROM public.portal_notifications GROUP BY type
UNION ALL
SELECT 'H_NOTIFICATION_VALUES','portal_notifications.priority',priority,COUNT(*) FROM public.portal_notifications GROUP BY priority
UNION ALL
SELECT 'H_NOTIFICATION_VALUES','reminder_policies.event_type',event_type,COUNT(*) FROM public.reminder_policies GROUP BY event_type
UNION ALL
SELECT 'H_NOTIFICATION_VALUES','reminder_policies.recipient_role',recipient_role,COUNT(*) FROM public.reminder_policies GROUP BY recipient_role
ORDER BY field, value;


-- I. CHECK CONSTRAINTS
SELECT
    'I_CHECK_CONSTRAINTS' AS section,
    c.relname AS table_name,
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN (
      'profiles','portal_access_requests','cohorts','enrollments',
      'schedule_events','class_attendance','session_records','enrollment_holds',
      'student_fee_packages','student_fee_payments','trainer_earnings',
      'trainer_finance','trainer_payouts','communication_messages',
      'portal_notifications','reminder_policies'
  )
  AND con.contype='c'
ORDER BY c.relname, con.conname;


-- J. COURSE CATALOGUE
SELECT
    'J_COURSE_CATALOGUE' AS section,
    code, title, public_name, category, grade_from, grade_to, status
FROM public.courses
ORDER BY title;

SELECT
    'J_COURSE_COUNT' AS section,
    COUNT(*) AS total_courses
FROM public.courses;


-- K. FINAL HEALTH
SELECT
    'K_FINAL_HEALTH' AS section,

    CASE WHEN (SELECT COUNT(*) FROM public.academic_levels)=19
         THEN 'OK' ELSE 'CHECK' END AS academic_levels,

    CASE WHEN (SELECT COUNT(*) FROM public.currencies WHERE is_active=TRUE)=16
         THEN 'OK' ELSE 'CHECK' END AS active_currencies,

    CASE WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE role NOT IN ('admin','trainer','parent','student')
    ) THEN 'OK' ELSE 'CHECK' END AS profile_roles,

    CASE WHEN NOT EXISTS (
        SELECT 1 FROM public.portal_access_requests
        WHERE status NOT IN ('invited','linked','disabled')
    ) THEN 'OK' ELSE 'CHECK' END AS access_statuses,

    CASE WHEN EXISTS (
        SELECT 1 FROM public.system_settings
        WHERE key='organisation_name' AND value_text='Robotronix™'
    )
    AND EXISTS (
        SELECT 1 FROM public.system_settings
        WHERE key='portal_url'
          AND value_text='https://portal.robotronixstemlab.com'
    ) THEN 'OK' ELSE 'CHECK' END AS organisation_settings,

    CASE WHEN EXISTS (
        SELECT 1 FROM public.system_settings
        WHERE key='support_email'
          AND COALESCE(TRIM(value_text),'')<>''
          AND value_text<>'YOUR_SUPPORT_EMAIL_HERE'
    )
    AND EXISTS (
        SELECT 1 FROM public.system_settings
        WHERE key='support_phone'
          AND COALESCE(TRIM(value_text),'')<>''
          AND value_text<>'YOUR_SUPPORT_PHONE_HERE'
    ) THEN 'OK' ELSE 'CHECK' END AS support_contacts;


-- ============================================================
-- END OF READ-ONLY VERIFICATION
-- ============================================================


-- ============================================================================
-- RAZORPAY / BILLING VERIFICATION
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ ADDRESS + RAZORPAY MODULE VERIFICATION V2
-- File: 13_razorpay_invoice_verification_v2.sql
-- READ ONLY
-- ============================================================

-- Required tables
SELECT
    to_regclass('public.parent_addresses') AS parent_addresses,
    to_regclass('public.parent_billing_profiles') AS parent_billing_profiles,
    to_regclass('public.invoice_sequences') AS invoice_sequences,
    to_regclass('public.student_invoices') AS student_invoices;

-- Standard family address fields
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='parent_addresses'
ORDER BY ordinal_position;

-- Billing profile fields
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='parent_billing_profiles'
ORDER BY ordinal_position;

-- Onboarding fields added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='onboarding_submissions'
  AND column_name IN (
    'address_line1',
    'address_line2',
    'postal_code',
    'billing_same_as_primary_guardian',
    'billing_same_as_primary_address',
    'billing_name',
    'billing_email',
    'billing_phone',
    'billing_address_line1',
    'billing_address_line2',
    'billing_city',
    'billing_state',
    'billing_postal_code',
    'billing_country',
    'billing_country_code'
  )
ORDER BY column_name;

-- Guardian snapshot fields added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='student_guardians'
  AND column_name IN (
    'address_line1',
    'address_line2',
    'postal_code',
    'billing_same_as_primary_guardian',
    'billing_same_as_primary_address',
    'billing_name',
    'billing_email',
    'billing_phone',
    'billing_address_line1',
    'billing_address_line2',
    'billing_city',
    'billing_state',
    'billing_postal_code',
    'billing_country',
    'billing_country_code'
  )
ORDER BY column_name;

-- Invoice settings
SELECT key, value_text, description
FROM public.system_settings
WHERE key LIKE 'invoice_%'
ORDER BY key;

-- Invoice numbering function exists
SELECT
    n.nspname AS schema_name,
    p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname='next_robotronix_invoice_number';

-- Invoice delete guard trigger
SELECT
    tgname,
    CASE tgenabled
      WHEN 'O' THEN 'ENABLED'
      WHEN 'D' THEN 'DISABLED'
      WHEN 'R' THEN 'REPLICA'
      WHEN 'A' THEN 'ALWAYS'
      ELSE tgenabled::text
    END AS trigger_state
FROM pg_trigger
WHERE tgrelid='public.student_invoices'::regclass
  AND tgname='guard_student_invoice_delete_trg';

-- Existing master data preserved
SELECT
    (SELECT COUNT(*) FROM public.countries) AS countries,
    (SELECT COUNT(*) FROM public.currencies WHERE is_active=true) AS active_currencies,
    (SELECT COUNT(*) FROM public.academic_levels WHERE is_active=true) AS academic_levels,
    (SELECT COUNT(*) FROM public.courses WHERE code LIKE 'RTX-%') AS production_courses,
    (SELECT COUNT(*) FROM public.profiles WHERE role='admin' AND active=true) AS active_admins;


-- ============================================================================
-- FUNCTIONAL EXTENSION VERIFICATION
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ READ-ONLY VERIFICATION
-- File: 17_v1_2_0_verification.sql
-- ============================================================

SELECT
  column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='enrollments'
  AND column_name IN (
    'program_model','planned_sessions','paid_session_balance',
    'planned_end_date','auto_complete_on_session_limit'
  )
ORDER BY column_name;

SELECT
  program_model,
  count(*) AS enrollments
FROM public.enrollments
GROUP BY program_model
ORDER BY program_model;

SELECT
  tgname,
  CASE tgenabled WHEN 'O' THEN 'ENABLED' WHEN 'D' THEN 'DISABLED' ELSE tgenabled::text END AS state
FROM pg_trigger
WHERE tgrelid='public.schedule_events'::regclass
  AND tgname IN ('schedule_notification_insert','schedule_notification_update')
ORDER BY tgname;

SELECT
  indexname
FROM pg_indexes
WHERE schemaname='public'
  AND indexname IN (
    'portal_notifications_dedupe_uidx',
    'onboarding_submissions_user_status_idx'
  )
ORDER BY indexname;

SELECT key,value_text,description
FROM public.system_settings
WHERE key IN (
  'enrollment_completion_warning_sessions',
  'open_ended_require_paid_balance'
)
ORDER BY key;

SELECT
  (SELECT COUNT(*) FROM public.courses WHERE code LIKE 'RTX-%') AS production_courses,
  (SELECT COUNT(*) FROM public.academic_levels WHERE is_active=true) AS active_academic_levels,
  (SELECT COUNT(*) FROM public.currencies WHERE is_active=true) AS active_currencies,
  (SELECT COUNT(*) FROM public.profiles WHERE role='admin' AND active=true) AS active_admins;


-- ============================================================================
-- FINAL V1 READ-ONLY VERIFICATION
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ FINAL v1.0 — READ-ONLY EXTENSION VERIFICATION
-- File: 20_final_v1_verification.sql
-- ============================================================

SELECT column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='enrollments'
  AND column_name IN (
    'program_model','planned_sessions','paid_session_balance','planned_end_date',
    'auto_complete_on_session_limit','schedule_override_confirmed','schedule_override_note'
  )
ORDER BY column_name;

SELECT key,value_text,description
FROM public.system_settings
WHERE key IN (
  'enrollment_completion_warning_sessions',
  'open_ended_require_paid_balance',
  'schedule_soft_constraint_override'
)
ORDER BY key;

SELECT indexname
FROM pg_indexes
WHERE schemaname='public'
  AND indexname IN ('portal_notifications_dedupe_uidx','onboarding_submissions_user_status_idx')
ORDER BY indexname;

SELECT
  (SELECT COUNT(*) FROM public.courses WHERE code LIKE 'RTX-%') AS production_courses,
  (SELECT COUNT(*) FROM public.academic_levels WHERE is_active=true) AS active_academic_levels,
  (SELECT COUNT(*) FROM public.currencies WHERE is_active=true) AS active_currencies,
  (SELECT COUNT(*) FROM public.profiles WHERE role='admin' AND active=true) AS active_admins;


-- ============================================================================
-- TRAINER / COMMUNITY / RATECARD READ-ONLY VERIFICATION
-- ============================================================================

-- READ-ONLY verification for SQL 21-23 state
select 'trainer accountability columns' as check_name, count(*) as found
from information_schema.columns
where table_schema='public' and table_name='trainer_compensation_plans'
  and column_name in ('trainer_no_show_penalty_percent','late_grace_minutes','late_penalty_percent');

select 'community/profile tables' as check_name, count(*) as found
from information_schema.tables
where table_schema='public' and table_name in ('parent_community_profiles','family_introductions','trainer_finance_change_requests');

select 'trainer finance policies' as check_name, count(*) as found
from pg_policies
where schemaname='public' and policyname in ('trainer_finance_trainer_select','trainer_comp_plans_trainer_select','trainer_finance_requests_select');


-- ============================================================================
-- PRODUCTION V1.0.0 RELEASE-SPECIFIC ASSERTIONS
-- ============================================================================


DO $$
BEGIN
  IF to_regclass('public.student_invoices') IS NULL THEN RAISE EXCEPTION 'Missing student_invoices'; END IF;
  IF to_regclass('public.parent_billing_profiles') IS NULL THEN RAISE EXCEPTION 'Missing parent_billing_profiles'; END IF;
  IF to_regclass('public.trainer_compensation_plans') IS NULL THEN RAISE EXCEPTION 'Missing trainer_compensation_plans'; END IF;
  IF to_regclass('public.onboarding_submissions') IS NULL THEN RAISE EXCEPTION 'Missing onboarding_submissions'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='onboarding_submission_admin_notification_trg') THEN
    RAISE EXCEPTION 'Missing onboarding Admin notification trigger';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE code LIKE 'RTX-%' AND status='active') THEN
    RAISE EXCEPTION 'Production course catalogue is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.academic_levels WHERE code='GRADE_12') THEN
    RAISE EXCEPTION 'Academic master is incomplete';
  END IF;
END $$;

SELECT
  (SELECT count(*) FROM public.countries) AS countries,
  (SELECT count(*) FROM public.timezones) AS timezones,
  (SELECT count(*) FROM public.currencies) AS currencies,
  (SELECT count(*) FROM public.academic_levels) AS academic_levels,
  (SELECT count(*) FROM public.courses WHERE code LIKE 'RTX-%') AS robotronix_courses;

SELECT 'Robotronix Production v1.0.0 verification completed' AS status, now() AS verified_at;

-- I. ACTIVE-STUDENT MIGRATION / PRIVACY ADDITIONS
SELECT
  'I_ACTIVE_STUDENT_MIGRATION_COLUMNS' AS section,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='enrollments'
  AND column_name IN (
    'migration_type','opening_completed_sessions','opening_completed_minutes',
    'migration_note','portal_tracking_started_at','planned_sessions'
  )
ORDER BY column_name;

SELECT
  'I_FINANCE_MIGRATION_COLUMNS' AS section,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND ((table_name='student_fee_packages' AND column_name IN ('source','notes'))
    OR (table_name='student_fee_payments' AND column_name='source'))
ORDER BY table_name,column_name;

SELECT
  'I_PRIVATE_LEARNING_NOTES_TABLE' AS section,
  CASE WHEN to_regclass('public.learning_observation_internal_notes') IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS result;

SELECT
  'I_OPENING_PROGRESS_TRIGGER' AS section,
  tgname AS trigger_name,
  CASE WHEN tgenabled <> 'D' THEN 'ENABLED' ELSE 'DISABLED' END AS result
FROM pg_trigger
WHERE tgrelid='public.enrollments'::regclass
  AND tgname='enrollment_opening_progress_trigger';

SELECT
  'I_INTERNAL_NOTE_POLICIES' AS section,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname='public'
  AND tablename='learning_observation_internal_notes'
ORDER BY policyname;


-- J. ZOOM CLASSROOM POC FOUNDATION
SELECT
  'J_ZOOM_POC_TABLES' AS section,
  table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('zoom_host_accounts','zoom_meetings')
ORDER BY table_name;

DO $$
BEGIN
  IF to_regclass('public.zoom_host_accounts') IS NULL THEN RAISE EXCEPTION 'Missing zoom_host_accounts'; END IF;
  IF to_regclass('public.zoom_meetings') IS NULL THEN RAISE EXCEPTION 'Missing zoom_meetings'; END IF;
END $$;


-- K. DEMO EXPERIENCE V1
SELECT
  'K_DEMO_EXPERIENCE_TABLES' AS section,
  table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('demo_leads','demo_sessions','demo_session_participants','demo_guest_requests')
ORDER BY table_name;

DO $$
BEGIN
  IF to_regclass('public.demo_leads') IS NULL THEN RAISE EXCEPTION 'Missing demo_leads'; END IF;
  IF to_regclass('public.demo_sessions') IS NULL THEN RAISE EXCEPTION 'Missing demo_sessions'; END IF;
  IF to_regclass('public.demo_session_participants') IS NULL THEN RAISE EXCEPTION 'Missing demo_session_participants'; END IF;
  IF to_regclass('public.demo_guest_requests') IS NULL THEN RAISE EXCEPTION 'Missing demo_guest_requests'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='zoom_meetings_demo_schedule_event_unique'
  ) THEN RAISE EXCEPTION 'Missing demo Zoom schedule uniqueness index'; END IF;
END $$;


-- L. Consolidated fresh-install guarantees (FAIL FAST; read-only).
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(expected.table_name, ', ' ORDER BY expected.table_name)
  INTO missing
  FROM (VALUES
    ('zoom_join_intents'),('zoom_participant_sessions'),('zoom_recordings'),
    ('zoom_webhook_events'),('razorpay_webhook_events'),
    ('calendar_subscription_tokens'),('demo_leads'),('demo_sessions'),
    ('demo_session_participants'),('demo_guest_requests')
  ) AS expected(table_name)
  WHERE to_regclass('public.' || expected.table_name) IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing consolidated tables: %', missing;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='zoom_host_active_meeting_no_overlap'
      AND conrelid=to_regclass('public.zoom_meetings')
      AND contype='x'
  ) THEN RAISE EXCEPTION 'Missing Zoom host overlapping-meeting exclusion constraint'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='onboarding_submission_admin_notification_trg'
      AND tgrelid=to_regclass('public.onboarding_submissions')
      AND NOT tgisinternal AND tgenabled <> 'D'
  ) THEN RAISE EXCEPTION 'Missing/disabled Admin onboarding notification trigger'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid=to_regclass('public.zoom_meetings')
      AND conname='zoom_meetings_purpose_check'
      AND pg_get_constraintdef(oid) ILIKE '%demo%'
  ) THEN RAISE EXCEPTION 'Zoom meeting purpose check does not include demo'; END IF;
END $$;

SELECT
  'L_CONSOLIDATED_FEATURES' AS section,
  'Core consolidated objects/constraints' AS check_name,
  'PASS' AS result;


-- Consolidated stabilization verification — additive, read-only.
do $$
declare obj text;
begin
 foreach obj in array array[
  'portal_system_logs','trainer_finance_change_requests',
  'trainer_payout_instruction_versions','trainer_payouts',
  'portal_notifications','portal_access_requests','progress_alert_actions'
 ] loop
  if to_regclass('public.'||obj) is null then
   raise exception 'Missing stabilization table: %',obj;
  end if;
 end loop;
 foreach obj in array array[
  'trainer_payout_action_insert_trg','trainer_payout_action_update_trg',
  'progress_action_insert_trg','progress_action_update_trg',
  'schedule_admin_action_update_trg','trainer_payout_instruction_lock_trg',
  'trainer_finance_direct_change_version_trg','onboarding_submission_admin_notification_trg'
 ] loop
  if not exists(select 1 from pg_trigger where tgname=obj and not tgisinternal and tgenabled<>'D') then
   raise exception 'Missing/disabled stabilization trigger: %',obj;
  end if;
 end loop;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='portal_system_logs' and policyname='portal_system_logs_admin_read') then
  raise exception 'Missing Admin-only diagnostics policy';
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='trainer_payout_instruction_versions' and policyname='trainer_payout_versions_admin_read') then
  raise exception 'Missing approved payout-instruction RLS policy';
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='portal_notifications') then
  raise exception 'portal_notifications not included in Supabase Realtime publication';
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.portal_access_requests'::regclass
    and conname='portal_access_requests_status_check' and pg_get_constraintdef(oid) like '%provisioned%') then
  raise exception 'Passwordless provisioned access state not installed';
 end if;
end $$;
select 'STABILIZATION_DATABASE_GATES' as section,'PASS' as result;


-- Scheduling V2 post-install verification (read-only, DEV database first).
do $$
declare fn text;
begin
 foreach fn in array array[
  'generate_enrollment_schedule_v2(uuid,text,integer)',
  'generate_cohort_schedule_v2(uuid,text,integer)',
  'reassign_enrollment_trainer_v2(uuid,uuid,text)',
  'reassign_cohort_trainer_v2(uuid,uuid,text)',
  'pause_enrollment_v2(uuid,date,date,text,text)',
  'pause_cohort_member_v2(uuid,date,date,text,text)',
  'resume_enrollment_v2(uuid,text)',
  'cancel_class_v2(uuid,text,text)',
  'reschedule_class_v2(uuid,date,time,time,text,text)',
  'create_makeup_class_v2(uuid,date,time,time,text)',
  'resolve_class_cancellation_v2(uuid,text,text)',
  'class_reusable_zoom_link_v2(uuid)'
 ] loop
  if to_regprocedure('public.'||fn) is null then
   raise exception 'Scheduling V2 function missing: %',fn;
  end if;
 end loop;
 if not exists(select 1 from pg_indexes where schemaname='public'
  and indexname='schedule_events_generation_key_unique') then
   raise exception 'Scheduling V2 occurrence idempotency index missing';
 end if;
 if not exists(select 1 from pg_trigger where tgname='mark_class_cancellation_for_review_v2'
  and not tgisinternal and tgenabled<>'D') then
   raise exception 'Cancellation review trigger missing or disabled';
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public'
  and table_name='trainers' and column_name='zoom_join_url') then
   raise exception 'Trainer reusable Zoom URL column missing';
 end if;
end $$;
select 'SCHEDULING_V2_OBJECT_GATES' as section,'PASS' as result;


-- Security acceptance gates (read-only; validate on a separate DEV database).
do $$
declare v_table text; v_rpc text; v_fn oid;
begin
 foreach v_table in array array[
  'profiles','parents','students','student_guardians','parent_students',
  'enrollments','cohorts','schedule_events','class_attendance',
  'trainer_earnings','trainer_finance','student_fee_payments',
  'portal_notifications','communication_messages'
 ] loop
  if to_regclass('public.'||v_table) is null then
   raise exception 'Security acceptance: missing sensitive table %',v_table;
  end if;
  if not exists(
   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=v_table and c.relrowsecurity
  ) then raise exception 'Security acceptance: RLS not enabled for %',v_table; end if;
 end loop;
 foreach v_rpc in array array[
  'generate_enrollment_schedule_v2(uuid,text,integer)',
  'generate_cohort_schedule_v2(uuid,text,integer)',
  'reassign_enrollment_trainer_v2(uuid,uuid,text)',
  'reassign_cohort_trainer_v2(uuid,uuid,text)',
  'pause_enrollment_v2(uuid,date,date,text,text)',
  'pause_cohort_member_v2(uuid,date,date,text,text)',
  'resume_enrollment_v2(uuid,text)',
  'cancel_class_v2(uuid,text,text)',
  'reschedule_class_v2(uuid,date,time,time,text,text)',
  'create_makeup_class_v2(uuid,date,time,time,text)',
  'resolve_class_cancellation_v2(uuid,text,text)',
  'class_reusable_zoom_link_v2(uuid)'
 ] loop
  v_fn:=to_regprocedure('public.'||v_rpc);
  if v_fn is null then raise exception 'Security acceptance: missing RPC %',v_rpc; end if;
  if has_function_privilege('anon',v_fn,'EXECUTE') then
    raise exception 'Security acceptance: anonymous EXECUTE permission on %',v_rpc;
  end if;
 end loop;
end $$;
select 'SECURITY_RLS_AND_PRIVILEGED_RPC_GATE' as section, 'PASS' as result;

-- Phase 2–4 additive migration verification (read-only).
do $$
begin
 if to_regprocedure('public.replace_trainer_availability_v1(uuid,jsonb)') is null then
  raise exception 'Phase 3 atomic trainer availability function missing';
 end if;
 if has_function_privilege('anon','public.replace_trainer_availability_v1(uuid,jsonb)','EXECUTE') then
  raise exception 'Anonymous access to trainer availability RPC is forbidden';
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='onboarding_submissions' and column_name='activated_student_id') or
    not exists(select 1 from information_schema.columns where table_schema='public' and table_name='onboarding_submissions' and column_name='activated_enrollment_id') then
  raise exception 'Phase 2 activated onboarding reference columns missing';
 end if;
 if not exists(select 1 from pg_constraint where conname='zoom_host_active_meeting_no_overlap' and conrelid='public.zoom_meetings'::regclass) then
  raise exception 'Zoom host active-window concurrency exclusion constraint missing';
 end if;
end $$;
select 'PHASES_2_3_4_MIGRATION_GATES' as section,'PASS' as result;

-- Recent P0/P1 audit requirements are part of the canonical fresh-install schema.
-- This verification is read-only and must pass without running any additive patch.
do $$
declare item text;
begin
 foreach item in array array['portal_access_requests','student_invoices','zoom_meetings','zoom_recordings'] loop
  if to_regclass('public.'||item) is null then
   raise exception 'Missing audited table %',item;
  end if;
  if not exists (
    select 1 from pg_trigger trg
    join pg_class cls on cls.oid=trg.tgrelid
    join pg_namespace ns on ns.oid=cls.relnamespace
    where ns.nspname='public' and cls.relname=item
      and trg.tgname='audit_'||item and not trg.tgisinternal and trg.tgenabled<>'D'
  ) then raise exception 'Canonical P0/P1 audit trigger missing: %',item; end if;
 end loop;
 if not exists(
  select 1 from pg_trigger
  where tgname='onboarding_submission_admin_notification_trg'
    and tgrelid='public.onboarding_submissions'::regclass and not tgisinternal and tgenabled<>'D'
 ) then raise exception 'Onboarding admin notification trigger missing'; end if;
end $$;
select 'CONSOLIDATED_AUDIT_COVERAGE_GATE' as section,'PASS' as result;

-- P0/P1 audit coverage verification (read only)
-- Verification:
SELECT c.relname AS table_name, t.tgname AS audit_trigger, t.tgenabled AS enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_trigger t ON t.tgrelid=c.oid AND t.tgname='audit_'||c.relname
WHERE n.nspname='public' AND c.relname IN ('portal_access_requests','student_invoices','zoom_meetings','zoom_recordings')
ORDER BY c.relname;
