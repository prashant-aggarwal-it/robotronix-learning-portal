# Existing Education Suite 167-table ownership register
**Source:** live DEV table listing inspected on 2026-11-14. Owner categories are architectural classifications inferred from schema/table names; they are NOT line-by-line code consumer or business ownership verification. Preserve all tables in Release 1.

Counts: connect: 66; public: 80; tasks: 21; total 167.

| Schema | Table | Proposed logical owner | Disposition |
|---|---|---|---|
| `connect` | `activities` | CRM | Retain; review in later compatibility phase |
| `connect` | `appointments` | CRM | Retain; review in later compatibility phase |
| `connect` | `attribution` | CRM | Retain; review in later compatibility phase |
| `connect` | `audit_events` | CRM | Retain; review in later compatibility phase |
| `connect` | `automation_settings` | CRM | Retain; review in later compatibility phase |
| `connect` | `campaign_spend` | CRM | Retain; review in later compatibility phase |
| `connect` | `campaigns` | CRM | Retain; review in later compatibility phase |
| `connect` | `channel_accounts` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `consent_events` | CRM | Retain; review in later compatibility phase |
| `connect` | `contact_duplicate_decisions` | CRM | Retain; review in later compatibility phase |
| `connect` | `contact_import_batches` | CRM | Retain; review in later compatibility phase |
| `connect` | `contact_import_details` | CRM | Retain; review in later compatibility phase |
| `connect` | `contact_import_items` | CRM | Retain; review in later compatibility phase |
| `connect` | `contact_marketing_permissions` | CRM | Retain; review in later compatibility phase |
| `connect` | `contact_methods` | CRM | Retain; review in later compatibility phase |
| `connect` | `contact_owners` | CRM | Retain; review in later compatibility phase |
| `connect` | `contact_profiles` | CRM | Retain; review in later compatibility phase |
| `connect` | `contact_saved_segments` | CRM | Retain; review in later compatibility phase |
| `connect` | `conversations` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `email_conversation_recipients` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `email_message_headers` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `enquiry_categories` | CRM | Retain; review in later compatibility phase |
| `connect` | `entitlements` | CRM Identity/Tenancy | Retain; review in later compatibility phase |
| `connect` | `external_links` | CRM | Retain; review in later compatibility phase |
| `connect` | `form_keys` | CRM | Retain; review in later compatibility phase |
| `connect` | `household_members` | CRM | Retain; review in later compatibility phase |
| `connect` | `households` | CRM | Retain; review in later compatibility phase |
| `connect` | `inquiries` | CRM | Retain; review in later compatibility phase |
| `connect` | `integration_connections` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `invitations` | CRM Identity/Tenancy | Retain; review in later compatibility phase |
| `connect` | `memberships` | CRM Identity/Tenancy | Retain; future extensions reference existing identity |
| `connect` | `message_attachments` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `messages` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `opportunities` | CRM | Retain; review in later compatibility phase |
| `connect` | `opportunity_people` | CRM | Retain; review in later compatibility phase |
| `connect` | `opportunity_programs` | CRM | Retain; review in later compatibility phase |
| `connect` | `organization_contacts` | CRM | Retain; review in later compatibility phase |
| `connect` | `organizations` | CRM | Retain; future extensions reference existing identity |
| `connect` | `outbox` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `people` | CRM | Retain; future extensions reference existing identity |
| `connect` | `person_relations` | CRM | Retain; review in later compatibility phase |
| `connect` | `person_roles` | CRM | Retain; review in later compatibility phase |
| `connect` | `pipeline_stages` | CRM | Retain; review in later compatibility phase |
| `connect` | `pipelines` | CRM | Retain; review in later compatibility phase |
| `connect` | `plans` | CRM Identity/Tenancy | Retain; review in later compatibility phase |
| `connect` | `portal_admission_handoffs` | CRM ↔ Academy bridge | Retain; review in later compatibility phase |
| `connect` | `portal_demo_followup_receipts` | CRM ↔ Academy bridge | Retain; review in later compatibility phase |
| `connect` | `portal_demo_integrations` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `portal_demo_links` | CRM ↔ Academy bridge | Retain; review in later compatibility phase |
| `connect` | `portal_lifecycle_summaries` | CRM ↔ Academy bridge | Retain; review in later compatibility phase |
| `connect` | `portal_renewal_signals` | CRM ↔ Academy bridge | Retain; review in later compatibility phase |
| `connect` | `programs` | CRM | Retain; review in later compatibility phase |
| `connect` | `realized_revenue` | CRM | Retain; review in later compatibility phase |
| `connect` | `staff_notifications` | CRM | Retain; review in later compatibility phase |
| `connect` | `stage_events` | CRM | Retain; review in later compatibility phase |
| `connect` | `subscriptions` | CRM Identity/Tenancy | Retain; review in later compatibility phase |
| `connect` | `tasks` | CRM | Retain; review in later compatibility phase |
| `connect` | `tenants` | CRM Identity/Tenancy | Retain; future extensions reference existing identity |
| `connect` | `webhook_receipts` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `whatsapp_app_contacts` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `whatsapp_delivery_events` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `whatsapp_enquiry_triage` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `whatsapp_history_jobs` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `whatsapp_send_requests` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `whatsapp_thread_state` | CRM Communications | Retain; review in later compatibility phase |
| `connect` | `workspace_preferences` | CRM Identity/Tenancy | Retain; review in later compatibility phase |
| `public` | `academic_levels` | Academy Reference | Retain; review in later compatibility phase |
| `public` | `calendar_subscription_tokens` | Academy | Retain; review in later compatibility phase |
| `public` | `cities` | Academy | Retain; review in later compatibility phase |
| `public` | `city_aliases` | Academy Reference | Retain; review in later compatibility phase |
| `public` | `class_attendance` | Academy | Retain; review in later compatibility phase |
| `public` | `cohorts` | Academy | Retain; review in later compatibility phase |
| `public` | `communication_messages` | Academy Communications | Retain; review in later compatibility phase |
| `public` | `communication_threads` | Academy Communications | Retain; review in later compatibility phase |
| `public` | `correction_requests` | Academy | Retain; review in later compatibility phase |
| `public` | `countries` | Academy | Retain; review in later compatibility phase |
| `public` | `course_academic_levels` | Academy Reference | Retain; review in later compatibility phase |
| `public` | `courses` | Academy | Retain; review in later compatibility phase |
| `public` | `currencies` | Academy Reference | Retain; review in later compatibility phase |
| `public` | `delivery_centers` | Academy | Retain; review in later compatibility phase |
| `public` | `demo_guest_requests` | Academy | Retain; review in later compatibility phase |
| `public` | `demo_leads` | Academy | Retain; review in later compatibility phase |
| `public` | `demo_session_participants` | Academy | Retain; review in later compatibility phase |
| `public` | `demo_sessions` | Academy | Retain; review in later compatibility phase |
| `public` | `enrollment_holds` | Academy | Retain; review in later compatibility phase |
| `public` | `enrollments` | Academy | Retain; review in later compatibility phase |
| `public` | `family_introductions` | Academy | Retain; review in later compatibility phase |
| `public` | `invoice_sequences` | Academy Finance | Retain; review in later compatibility phase |
| `public` | `learner_projects` | Academy Learning | Retain; review in later compatibility phase |
| `public` | `learning_observation_internal_notes` | Academy Learning | Retain; review in later compatibility phase |
| `public` | `learning_observations` | Academy Learning | Retain; review in later compatibility phase |
| `public` | `onboarding_submissions` | Academy | Retain; review in later compatibility phase |
| `public` | `parent_addresses` | Academy | Retain; review in later compatibility phase |
| `public` | `parent_billing_profiles` | Academy Finance | Retain; review in later compatibility phase |
| `public` | `parent_community_profiles` | Academy | Retain; review in later compatibility phase |
| `public` | `parent_students` | Academy | Retain; review in later compatibility phase |
| `public` | `parents` | Academy | Retain; review in later compatibility phase |
| `public` | `portal_access_requests` | Academy | Retain; review in later compatibility phase |
| `public` | `portal_alert_dispatches` | Academy Communications | Retain; review in later compatibility phase |
| `public` | `portal_audit_log` | Academy Operations | Retain; review in later compatibility phase |
| `public` | `portal_job_runs` | Academy Operations | Retain; review in later compatibility phase |
| `public` | `portal_log_issues` | Academy Operations | Retain; review in later compatibility phase |
| `public` | `portal_notifications` | Academy Communications | Retain; review in later compatibility phase |
| `public` | `portal_operational_alert_states` | Academy Communications | Retain; review in later compatibility phase |
| `public` | `portal_system_logs` | Academy Operations | Retain; review in later compatibility phase |
| `public` | `profiles` | Academy | Retain; review in later compatibility phase |
| `public` | `progress_alert_actions` | Academy Learning | Retain; review in later compatibility phase |
| `public` | `project_submissions` | Academy Learning | Retain; future extensions reference existing identity |
| `public` | `projects` | Academy Learning | Retain; future extensions reference existing identity |
| `public` | `quiz_attempts` | Academy Learning | Retain; future extensions reference existing identity |
| `public` | `quizzes` | Academy Learning | Retain; future extensions reference existing identity |
| `public` | `razorpay_webhook_events` | Academy Finance | Retain; review in later compatibility phase |
| `public` | `reference_data_sources` | Academy Reference | Retain; review in later compatibility phase |
| `public` | `reminder_policies` | Academy Communications | Retain; review in later compatibility phase |
| `public` | `schedule_events` | Academy | Retain; review in later compatibility phase |
| `public` | `session_records` | Academy | Retain; review in later compatibility phase |
| `public` | `states` | Academy Reference | Retain; review in later compatibility phase |
| `public` | `student_family_receipts` | Academy | Retain; review in later compatibility phase |
| `public` | `student_fee_packages` | Academy Finance | Retain; review in later compatibility phase |
| `public` | `student_fee_payments` | Academy Finance | Retain; future extensions reference existing identity |
| `public` | `student_guardians` | Academy | Retain; review in later compatibility phase |
| `public` | `student_invoices` | Academy Finance | Retain; future extensions reference existing identity |
| `public` | `students` | Academy | Retain; review in later compatibility phase |
| `public` | `system_settings` | Academy Reference | Retain; review in later compatibility phase |
| `public` | `timezones` | Academy Reference | Retain; review in later compatibility phase |
| `public` | `trainer_availability` | Academy | Retain; review in later compatibility phase |
| `public` | `trainer_availability_overrides` | Academy | Retain; review in later compatibility phase |
| `public` | `trainer_compensation_plans` | Academy Finance | Retain; review in later compatibility phase |
| `public` | `trainer_courses` | Academy | Retain; review in later compatibility phase |
| `public` | `trainer_earnings` | Academy Finance | Retain; review in later compatibility phase |
| `public` | `trainer_feedback` | Academy Finance | Retain; review in later compatibility phase |
| `public` | `trainer_finance` | Academy Finance | Retain; review in later compatibility phase |
| `public` | `trainer_finance_change_requests` | Academy Finance | Retain; review in later compatibility phase |
| `public` | `trainer_payout_instruction_versions` | Academy Finance | Retain; review in later compatibility phase |
| `public` | `trainer_payouts` | Academy Finance | Retain; review in later compatibility phase |
| `public` | `trainers` | Academy | Retain; review in later compatibility phase |
| `public` | `xp_transactions` | Academy Learning | Retain; future extensions reference existing identity |
| `public` | `zoom_class_host_reservations` | Academy Classroom | Retain; review in later compatibility phase |
| `public` | `zoom_class_provisioning_leases` | Academy Classroom | Retain; review in later compatibility phase |
| `public` | `zoom_host_accounts` | Academy Classroom | Retain; review in later compatibility phase |
| `public` | `zoom_join_intents` | Academy Classroom | Retain; review in later compatibility phase |
| `public` | `zoom_meetings` | Academy Classroom | Retain; review in later compatibility phase |
| `public` | `zoom_participant_sessions` | Academy Classroom | Retain; review in later compatibility phase |
| `public` | `zoom_recordings` | Academy Classroom | Retain; review in later compatibility phase |
| `public` | `zoom_refresh_leases` | Academy Classroom | Retain; review in later compatibility phase |
| `public` | `zoom_webhook_events` | Academy Classroom | Retain; review in later compatibility phase |
| `tasks` | `accounts` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `activity` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `areas` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `attachments` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `categories` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `comments` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `focus_commitments` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `focus_sessions` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `focus_settings` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `items` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `module_links` | Tasks | Retain; future extensions reference existing identity |
| `tasks` | `notifications` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `parked_ideas` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `projects` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `reminder_deliveries` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `subtasks` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `task_collaborators` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `user_preferences` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `workspace_invitations` | Tasks | Retain; review in later compatibility phase |
| `tasks` | `workspace_members` | Tasks | Retain; future extensions reference existing identity |
| `tasks` | `workspaces` | Tasks | Retain; future extensions reference existing identity |

## Next validation gates
- Compare every table to catalog snapshot for columns, indexes, foreign keys, policies and function consumers.
- Validate owners with application APIs and service layer before any module move.
- Do not consolidate `connect.tasks` with `tasks.items`, or existing project/quiz/XP tables with proposed future learning tables, without transaction/reconciliation tests.
- No production or DEV physical changes are authorized by this classification.
