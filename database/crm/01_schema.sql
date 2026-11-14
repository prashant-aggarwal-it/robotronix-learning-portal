-- CANONICAL CRM SCHEMA: final table definitions captured from development catalog.
-- Creates the final structure directly without incremental phase-by-phase ALTER patches.
-- Run once against the Portal/Auth database; do not run if connect schema already exists.
BEGIN;
DO $guard$ BEGIN IF to_regnamespace('connect') IS NOT NULL THEN RAISE EXCEPTION 'connect schema exists'; END IF; END $guard$;
CREATE SCHEMA connect;
REVOKE ALL ON SCHEMA connect FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA connect TO service_role;

-- activities
CREATE TABLE connect."activities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "opportunity_id" uuid,
  "person_id" uuid,
  "actor_membership_id" uuid,
  "kind" text NOT NULL,
  "summary" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "activities_check" CHECK (((opportunity_id IS NOT NULL) OR (person_id IS NOT NULL))),
  CONSTRAINT "activities_kind_check" CHECK ((kind = ANY (ARRAY['call'::text, 'note'::text, 'email'::text, 'message'::text, 'meeting'::text, 'trial'::text, 'other'::text]))),
  CONSTRAINT "activities_pkey" PRIMARY KEY (id),
  CONSTRAINT "activities_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- appointments
CREATE TABLE connect."appointments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "opportunity_id" uuid,
  "person_id" uuid,
  "owner_membership_id" uuid,
  "kind" text DEFAULT 'counselling'::text NOT NULL,
  "title" text NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'scheduled'::text NOT NULL,
  "external_calendar_ref" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "location" text,
  "meeting_url" text,
  "notes" text,
  "programme" text,
  "version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "appointments_check" CHECK ((ends_at > starts_at)),
  CONSTRAINT "appointments_kind_check" CHECK ((kind = ANY (ARRAY['counselling'::text, 'demo'::text, 'trial'::text, 'meeting'::text, 'other'::text]))),
  CONSTRAINT "appointments_pkey" PRIMARY KEY (id),
  CONSTRAINT "appointments_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]))),
  CONSTRAINT "appointments_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- attribution
CREATE TABLE connect."attribution" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "person_id" uuid,
  "opportunity_id" uuid,
  "campaign_id" uuid,
  "source" text NOT NULL,
  "medium" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "attribution_check" CHECK (((person_id IS NOT NULL) OR (opportunity_id IS NOT NULL))),
  CONSTRAINT "attribution_pkey" PRIMARY KEY (id)
);

-- audit_events
CREATE TABLE connect."audit_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "actor_membership_id" uuid,
  "event_type" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY (id)
);

-- automation_settings
CREATE TABLE connect."automation_settings" (
  "tenant_id" uuid NOT NULL,
  "assignment_enabled" boolean DEFAULT true NOT NULL,
  "initial_followup_enabled" boolean DEFAULT true NOT NULL,
  "followup_delay_hours" integer DEFAULT 24 NOT NULL,
  "reminders_enabled" boolean DEFAULT true NOT NULL,
  "reminder_advance_minutes" integer DEFAULT 30 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "automation_settings_followup_delay_hours_check" CHECK (((followup_delay_hours >= 1) AND (followup_delay_hours <= 168))),
  CONSTRAINT "automation_settings_pkey" PRIMARY KEY (tenant_id),
  CONSTRAINT "automation_settings_reminder_advance_minutes_check" CHECK (((reminder_advance_minutes >= 5) AND (reminder_advance_minutes <= 1440)))
);

-- campaign_spend
CREATE TABLE connect."campaign_spend" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "spent_on" date NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "currency" text NOT NULL,
  "note" text,
  "recorded_by" uuid,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "campaign_spend_amount_check" CHECK (((amount >= (0)::numeric) AND (amount <= 999999999999.99))),
  CONSTRAINT "campaign_spend_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text)),
  CONSTRAINT "campaign_spend_pkey" PRIMARY KEY (id),
  CONSTRAINT "campaign_spend_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- campaigns
CREATE TABLE connect."campaigns" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "source" text,
  "external_campaign_id" text,
  CONSTRAINT "campaigns_pkey" PRIMARY KEY (id),
  CONSTRAINT "campaigns_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- channel_accounts
CREATE TABLE connect."channel_accounts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "external_account_id" text,
  "display_name" text NOT NULL,
  "status" text DEFAULT 'inactive'::text NOT NULL,
  CONSTRAINT "channel_accounts_pkey" PRIMARY KEY (id),
  CONSTRAINT "channel_accounts_status_check" CHECK ((status = ANY (ARRAY['inactive'::text, 'active'::text, 'disabled'::text]))),
  CONSTRAINT "channel_accounts_tenant_id_id_key" UNIQUE (tenant_id, id),
  CONSTRAINT "channel_accounts_tenant_id_provider_external_account_id_key" UNIQUE (tenant_id, provider, external_account_id)
);

-- consent_events
CREATE TABLE connect."consent_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "channel" text NOT NULL,
  "purpose" text NOT NULL,
  "decision" text NOT NULL,
  "source" text NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "consent_events_decision_check" CHECK ((decision = ANY (ARRAY['granted'::text, 'withdrawn'::text]))),
  CONSTRAINT "consent_events_pkey" PRIMARY KEY (id)
);

-- contact_duplicate_decisions
CREATE TABLE connect."contact_duplicate_decisions" (
  "tenant_id" uuid NOT NULL,
  "first_person_id" uuid NOT NULL,
  "second_person_id" uuid NOT NULL,
  "decision" text NOT NULL,
  "actor_membership_id" uuid NOT NULL,
  "decided_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contact_duplicate_decisions_decision_check" CHECK ((decision = ANY (ARRAY['distinct'::text, 'merged'::text]))),
  CONSTRAINT "contact_duplicate_decisions_pkey" PRIMARY KEY (tenant_id, first_person_id, second_person_id)
);

-- contact_import_batches
CREATE TABLE connect."contact_import_batches" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "actor_membership_id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "source_type" text NOT NULL,
  "source_label" text NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  CONSTRAINT "contact_import_batches_pkey" PRIMARY KEY (id),
  CONSTRAINT "contact_import_batches_source_type_check" CHECK ((source_type = ANY (ARRAY['own'::text, 'event'::text, 'referral'::text, 'directory'::text, 'purchased'::text, 'other'::text]))),
  CONSTRAINT "contact_import_batches_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'finished'::text]))),
  CONSTRAINT "contact_import_batches_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- contact_import_details
CREATE TABLE connect."contact_import_details" (
  "tenant_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "source_batch_id" uuid NOT NULL,
  "company" text,
  "city" text,
  "notes" text,
  "tags" text[],
  "source_reference" text,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contact_import_details_pkey" PRIMARY KEY (tenant_id, person_id, source_batch_id)
);

-- contact_import_items
CREATE TABLE connect."contact_import_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "batch_id" uuid NOT NULL,
  "row_number" integer NOT NULL,
  "person_id" uuid,
  "result" text NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contact_import_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "contact_import_items_result_check" CHECK ((result = ANY (ARRAY['created'::text, 'existing'::text, 'skipped'::text]))),
  CONSTRAINT "contact_import_items_row_number_check" CHECK ((row_number > 0)),
  CONSTRAINT "contact_import_items_tenant_id_batch_id_row_number_key" UNIQUE (tenant_id, batch_id, row_number)
);

-- contact_marketing_permissions
CREATE TABLE connect."contact_marketing_permissions" (
  "tenant_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "channel" text DEFAULT 'whatsapp'::text NOT NULL,
  "status" text DEFAULT 'unknown'::text NOT NULL,
  "evidence" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contact_marketing_permissions_channel_check" CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'sms'::text]))),
  CONSTRAINT "contact_marketing_permissions_pkey" PRIMARY KEY (tenant_id, person_id, channel),
  CONSTRAINT "contact_marketing_permissions_status_check" CHECK ((status = ANY (ARRAY['unknown'::text, 'opted_in'::text, 'opted_out'::text])))
);

-- contact_methods
CREATE TABLE connect."contact_methods" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "normalized_value" text NOT NULL,
  "display_value" text NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contact_methods_kind_check" CHECK ((kind = ANY (ARRAY['mobile'::text, 'phone'::text, 'whatsapp'::text, 'email'::text, 'social'::text, 'other'::text]))),
  CONSTRAINT "contact_methods_normalized_value_check" CHECK ((length(TRIM(BOTH FROM normalized_value)) > 0)),
  CONSTRAINT "contact_methods_pkey" PRIMARY KEY (id),
  CONSTRAINT "contact_methods_tenant_id_id_key" UNIQUE (tenant_id, id),
  CONSTRAINT "contact_methods_tenant_id_person_id_kind_normalized_value_key" UNIQUE (tenant_id, person_id, kind, normalized_value)
);

-- contact_owners
CREATE TABLE connect."contact_owners" (
  "tenant_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "owner_membership_id" uuid NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "assigned_by_membership_id" uuid,
  CONSTRAINT "contact_owners_pkey" PRIMARY KEY (tenant_id, person_id)
);

-- contact_profiles
CREATE TABLE connect."contact_profiles" (
  "tenant_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "company" text,
  "city" text,
  "tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "notes" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contact_profiles_pkey" PRIMARY KEY (tenant_id, person_id)
);

-- contact_saved_segments
CREATE TABLE connect."contact_saved_segments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contact_saved_segments_pkey" PRIMARY KEY (id),
  CONSTRAINT "contact_saved_segments_tenant_id_name_key" UNIQUE (tenant_id, name)
);

-- conversations
CREATE TABLE connect."conversations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "channel_account_id" uuid NOT NULL,
  "person_id" uuid,
  "external_thread_id" text,
  "status" text DEFAULT 'open'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_message_at" timestamp with time zone,
  "assigned_membership_id" uuid,
  CONSTRAINT "conversations_pkey" PRIMARY KEY (id),
  CONSTRAINT "conversations_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'pending'::text, 'closed'::text]))),
  CONSTRAINT "conversations_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- email_conversation_recipients
CREATE TABLE connect."email_conversation_recipients" (
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "reply_to_email" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_conversation_recipients_pkey" PRIMARY KEY (tenant_id, conversation_id)
);

-- email_message_headers
CREATE TABLE connect."email_message_headers" (
  "tenant_id" uuid NOT NULL,
  "message_id" uuid NOT NULL,
  "message_header_id" text,
  "subject" text,
  CONSTRAINT "email_message_headers_pkey" PRIMARY KEY (tenant_id, message_id)
);

-- enquiry_categories
CREATE TABLE connect."enquiry_categories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "label" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "enquiry_categories_label_check" CHECK (((length(btrim(label)) >= 2) AND (length(btrim(label)) <= 80))),
  CONSTRAINT "enquiry_categories_pkey" PRIMARY KEY (id),
  CONSTRAINT "enquiry_categories_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- entitlements
CREATE TABLE connect."entitlements" (
  "plan_id" uuid NOT NULL,
  "feature_key" text NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "limit_value" integer,
  CONSTRAINT "entitlements_limit_value_check" CHECK (((limit_value IS NULL) OR (limit_value >= 0))),
  CONSTRAINT "entitlements_pkey" PRIMARY KEY (plan_id, feature_key)
);

-- external_links
CREATE TABLE connect."external_links" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "integration_id" uuid NOT NULL,
  "entity_kind" text NOT NULL,
  "local_entity_id" uuid NOT NULL,
  "external_entity_id" text NOT NULL,
  CONSTRAINT "external_links_entity_kind_check" CHECK ((entity_kind = ANY (ARRAY['person'::text, 'opportunity'::text, 'appointment'::text, 'program'::text, 'organization'::text]))),
  CONSTRAINT "external_links_pkey" PRIMARY KEY (id),
  CONSTRAINT "external_links_tenant_id_integration_id_entity_kind_externa_key" UNIQUE (tenant_id, integration_id, entity_kind, external_entity_id),
  CONSTRAINT "external_links_tenant_id_integration_id_entity_kind_local_e_key" UNIQUE (tenant_id, integration_id, entity_kind, local_entity_id)
);

-- form_keys
CREATE TABLE connect."form_keys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "channel_account_id" uuid NOT NULL,
  "token_sha256" text NOT NULL,
  "label" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "form_keys_pkey" PRIMARY KEY (id),
  CONSTRAINT "form_keys_tenant_id_id_key" UNIQUE (tenant_id, id),
  CONSTRAINT "form_keys_token_sha256_check" CHECK ((token_sha256 ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "form_keys_token_sha256_key" UNIQUE (token_sha256)
);

-- household_members
CREATE TABLE connect."household_members" (
  "tenant_id" uuid NOT NULL,
  "household_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "relation" text NOT NULL,
  "is_primary_contact" boolean DEFAULT false NOT NULL,
  CONSTRAINT "household_members_pkey" PRIMARY KEY (tenant_id, household_id, person_id)
);

-- households
CREATE TABLE connect."households" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "display_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "households_pkey" PRIMARY KEY (id),
  CONSTRAINT "households_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- inquiries
CREATE TABLE connect."inquiries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "person_id" uuid,
  "opportunity_id" uuid,
  "channel_account_id" uuid,
  "external_event_id" text,
  "source" text NOT NULL,
  "summary" text,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "category_id" uuid,
  CONSTRAINT "inquiries_pkey" PRIMARY KEY (id),
  CONSTRAINT "inquiries_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- integration_connections
CREATE TABLE connect."integration_connections" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "external_tenant_id" text,
  "display_name" text NOT NULL,
  "status" text DEFAULT 'inactive'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "integration_connections_pkey" PRIMARY KEY (id),
  CONSTRAINT "integration_connections_status_check" CHECK ((status = ANY (ARRAY['inactive'::text, 'active'::text, 'disabled'::text]))),
  CONSTRAINT "integration_connections_tenant_id_id_key" UNIQUE (tenant_id, id),
  CONSTRAINT "integration_connections_tenant_id_provider_external_tenant__key" UNIQUE (tenant_id, provider, external_tenant_id)
);

-- invitations
CREATE TABLE connect."invitations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "token_sha256" text NOT NULL,
  "invited_by" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invitations_check" CHECK ((expires_at > created_at)),
  CONSTRAINT "invitations_email_check" CHECK (((email = lower(btrim(email))) AND (POSITION(('@'::text) IN (email)) > 1))),
  CONSTRAINT "invitations_pkey" PRIMARY KEY (id),
  CONSTRAINT "invitations_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'counsellor'::text, 'viewer'::text]))),
  CONSTRAINT "invitations_tenant_id_id_key" UNIQUE (tenant_id, id),
  CONSTRAINT "invitations_token_sha256_check" CHECK ((length(token_sha256) = 64)),
  CONSTRAINT "invitations_token_sha256_key" UNIQUE (token_sha256)
);

-- memberships
CREATE TABLE connect."memberships" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text NOT NULL,
  "status" text DEFAULT 'invited'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "memberships_pkey" PRIMARY KEY (id),
  CONSTRAINT "memberships_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'counsellor'::text, 'viewer'::text]))),
  CONSTRAINT "memberships_status_check" CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text, 'disabled'::text]))),
  CONSTRAINT "memberships_tenant_id_id_key" UNIQUE (tenant_id, id),
  CONSTRAINT "memberships_tenant_id_user_id_key" UNIQUE (tenant_id, user_id)
);

-- message_attachments
CREATE TABLE connect."message_attachments" (
  "tenant_id" uuid NOT NULL,
  "message_id" uuid NOT NULL,
  "provider_attachment_id" text NOT NULL,
  "filename" text,
  "content_type" text,
  "size_bytes" bigint,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "message_attachments_pkey" PRIMARY KEY (tenant_id, message_id, provider_attachment_id),
  CONSTRAINT "message_attachments_size_bytes_check" CHECK (((size_bytes IS NULL) OR (size_bytes >= 0)))
);

-- messages
CREATE TABLE connect."messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "external_message_id" text,
  "direction" text NOT NULL,
  "body" text,
  "delivery_status" text DEFAULT 'received'::text NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "message_type" text DEFAULT 'text'::text NOT NULL,
  "media_id" text,
  "media_mime_type" text,
  "media_filename" text,
  "reply_to_external_message_id" text,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "read_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "failure_reason" text,
  "original_body" text,
  "edited_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "last_revision_at" timestamp with time zone,
  "is_historical" boolean DEFAULT false NOT NULL,
  CONSTRAINT "messages_direction_check" CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))),
  CONSTRAINT "messages_pkey" PRIMARY KEY (id),
  CONSTRAINT "messages_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- opportunities
CREATE TABLE connect."opportunities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "pipeline_id" uuid NOT NULL,
  "stage_id" uuid NOT NULL,
  "title" text NOT NULL,
  "contact_id" uuid,
  "organization_id" uuid,
  "owner_membership_id" uuid,
  "expected_value" numeric(14,2),
  "currency" text DEFAULT 'INR'::text NOT NULL,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "connect_opportunities_pipeline_unique" UNIQUE (tenant_id, pipeline_id, id),
  CONSTRAINT "opportunities_check" CHECK (((contact_id IS NOT NULL) OR (organization_id IS NOT NULL))),
  CONSTRAINT "opportunities_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text)),
  CONSTRAINT "opportunities_expected_value_check" CHECK ((expected_value >= (0)::numeric)),
  CONSTRAINT "opportunities_pkey" PRIMARY KEY (id),
  CONSTRAINT "opportunities_tenant_id_id_key" UNIQUE (tenant_id, id),
  CONSTRAINT "opportunities_title_check" CHECK ((length(TRIM(BOTH FROM title)) > 0)),
  CONSTRAINT "opportunities_version_check" CHECK ((version > 0))
);

-- opportunity_people
CREATE TABLE connect."opportunity_people" (
  "tenant_id" uuid NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "role" text DEFAULT 'learner'::text NOT NULL,
  CONSTRAINT "opportunity_people_pkey" PRIMARY KEY (tenant_id, opportunity_id, person_id, role)
);

-- opportunity_programs
CREATE TABLE connect."opportunity_programs" (
  "tenant_id" uuid NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "program_id" uuid NOT NULL,
  CONSTRAINT "opportunity_programs_pkey" PRIMARY KEY (tenant_id, opportunity_id, program_id)
);

-- organization_contacts
CREATE TABLE connect."organization_contacts" (
  "tenant_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "position_title" text,
  CONSTRAINT "organization_contacts_pkey" PRIMARY KEY (tenant_id, organization_id, person_id)
);

-- organizations
CREATE TABLE connect."organizations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "category" text DEFAULT 'other'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_name_check" CHECK ((length(TRIM(BOTH FROM name)) > 0)),
  CONSTRAINT "organizations_pkey" PRIMARY KEY (id),
  CONSTRAINT "organizations_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- outbox
CREATE TABLE connect."outbox" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "idempotency_key" text NOT NULL,
  "body" text NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone,
  CONSTRAINT "outbox_attempts_check" CHECK ((attempts >= 0)),
  CONSTRAINT "outbox_pkey" PRIMARY KEY (id),
  CONSTRAINT "outbox_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]))),
  CONSTRAINT "outbox_tenant_id_idempotency_key_key" UNIQUE (tenant_id, idempotency_key)
);

-- people
CREATE TABLE connect."people" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "people_full_name_check" CHECK ((length(TRIM(BOTH FROM full_name)) > 0)),
  CONSTRAINT "people_pkey" PRIMARY KEY (id),
  CONSTRAINT "people_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text]))),
  CONSTRAINT "people_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- person_relations
CREATE TABLE connect."person_relations" (
  "tenant_id" uuid NOT NULL,
  "from_person_id" uuid NOT NULL,
  "to_person_id" uuid NOT NULL,
  "relationship" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "person_relations_check" CHECK ((from_person_id <> to_person_id)),
  CONSTRAINT "person_relations_pkey" PRIMARY KEY (tenant_id, from_person_id, to_person_id, relationship),
  CONSTRAINT "person_relations_relationship_check" CHECK ((length(TRIM(BOTH FROM relationship)) > 0))
);

-- person_roles
CREATE TABLE connect."person_roles" (
  "tenant_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "role" text NOT NULL,
  CONSTRAINT "person_roles_pkey" PRIMARY KEY (tenant_id, person_id, role),
  CONSTRAINT "person_roles_role_check" CHECK ((role = ANY (ARRAY['learner'::text, 'guardian'::text, 'staff'::text, 'customer'::text, 'contact'::text, 'other'::text])))
);

-- pipeline_stages
CREATE TABLE connect."pipeline_stages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "pipeline_id" uuid NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer NOT NULL,
  "outcome" text DEFAULT 'open'::text NOT NULL,
  CONSTRAINT "pipeline_stages_outcome_check" CHECK ((outcome = ANY (ARRAY['open'::text, 'won'::text, 'lost'::text]))),
  CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY (id),
  CONSTRAINT "pipeline_stages_tenant_id_id_key" UNIQUE (tenant_id, id),
  CONSTRAINT "pipeline_stages_tenant_id_pipeline_id_id_key" UNIQUE (tenant_id, pipeline_id, id),
  CONSTRAINT "pipeline_stages_tenant_id_pipeline_id_sort_order_key" UNIQUE (tenant_id, pipeline_id, sort_order)
);

-- pipelines
CREATE TABLE connect."pipelines" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "kind" text DEFAULT 'admissions'::text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "pipelines_pkey" PRIMARY KEY (id),
  CONSTRAINT "pipelines_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- plans
CREATE TABLE connect."plans" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "plans_code_key" UNIQUE (code),
  CONSTRAINT "plans_pkey" PRIMARY KEY (id)
);

-- portal_admission_handoffs
CREATE TABLE connect."portal_admission_handoffs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "learner_person_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "payload_hash" text NOT NULL,
  "token_hash" text NOT NULL,
  "token_expires_at" timestamp with time zone NOT NULL,
  "offer_snapshot" jsonb NOT NULL,
  "acceptance_recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "acceptance_recorded_by" uuid NOT NULL,
  "guardian_consent_attested" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'invited'::text NOT NULL,
  "onboarding_submission_id" uuid,
  "portal_enrollment_id" uuid,
  "portal_student_id" uuid,
  "verified_at" timestamp with time zone,
  "verified_by" uuid,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "portal_admission_handoffs_offer_snapshot_check" CHECK ((jsonb_typeof(offer_snapshot) = 'object'::text)),
  CONSTRAINT "portal_admission_handoffs_pkey" PRIMARY KEY (id),
  CONSTRAINT "portal_admission_handoffs_status_check" CHECK ((status = ANY (ARRAY['invited'::text, 'onboarding_pending'::text, 'review_required'::text, 'enrollment_confirmed'::text, 'revoked'::text]))),
  CONSTRAINT "portal_admission_handoffs_tenant_id_request_id_key" UNIQUE (tenant_id, request_id),
  CONSTRAINT "portal_admission_handoffs_token_hash_key" UNIQUE (token_hash)
);

-- portal_demo_followup_receipts
CREATE TABLE connect."portal_demo_followup_receipts" (
  "tenant_id" uuid NOT NULL,
  "portal_participant_id" uuid NOT NULL,
  "outcome_kind" text NOT NULL,
  "task_id" uuid,
  "synced_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "portal_demo_followup_receipts_outcome_kind_check" CHECK ((outcome_kind = ANY (ARRAY['demo_feedback'::text, 'demo_no_show'::text]))),
  CONSTRAINT "portal_demo_followup_receipts_pkey" PRIMARY KEY (tenant_id, portal_participant_id, outcome_kind)
);

-- portal_demo_integrations
CREATE TABLE connect."portal_demo_integrations" (
  "tenant_id" uuid NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "installed_by" uuid NOT NULL,
  "installed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "portal_demo_integrations_pkey" PRIMARY KEY (tenant_id),
  CONSTRAINT "portal_demo_integrations_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text])))
);

-- portal_demo_links
CREATE TABLE connect."portal_demo_links" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "payload_hash" text NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "portal_session_id" uuid,
  "portal_schedule_event_id" uuid,
  "portal_participant_id" uuid,
  "status" text DEFAULT 'requested'::text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "failure_code" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "portal_demo_links_pkey" PRIMARY KEY (id),
  CONSTRAINT "portal_demo_links_status_check" CHECK ((status = ANY (ARRAY['requested'::text, 'provisioning'::text, 'scheduled'::text, 'cancelled'::text, 'failed'::text]))),
  CONSTRAINT "portal_demo_links_tenant_id_portal_session_id_key" UNIQUE (tenant_id, portal_session_id),
  CONSTRAINT "portal_demo_links_tenant_id_request_id_key" UNIQUE (tenant_id, request_id),
  CONSTRAINT "portal_demo_links_version_check" CHECK ((version > 0))
);

-- portal_lifecycle_summaries
CREATE TABLE connect."portal_lifecycle_summaries" (
  "tenant_id" uuid NOT NULL,
  "enrollment_id" uuid NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "learner_person_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "course_title" text NOT NULL,
  "enrollment_status" text NOT NULL,
  "sessions_completed" integer DEFAULT 0 NOT NULL,
  "planned_sessions" integer,
  "progress_percent" numeric,
  "attendance_count" integer DEFAULT 0 NOT NULL,
  "last_class_date" date,
  "package_id" uuid,
  "package_name" text,
  "billing_model" text,
  "paid_session_balance" integer,
  "package_end_date" date,
  "payment_attention" boolean DEFAULT false NOT NULL,
  "renewal_reason" text,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "portal_lifecycle_summaries_pkey" PRIMARY KEY (tenant_id, enrollment_id)
);

-- portal_renewal_signals
CREATE TABLE connect."portal_renewal_signals" (
  "tenant_id" uuid NOT NULL,
  "enrollment_id" uuid NOT NULL,
  "cycle_key" uuid NOT NULL,
  "reason" text NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "handled_by" uuid,
  "handled_at" timestamp with time zone,
  CONSTRAINT "portal_renewal_signals_pkey" PRIMARY KEY (tenant_id, enrollment_id, cycle_key),
  CONSTRAINT "portal_renewal_signals_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'contacted'::text, 'dismissed'::text])))
);

-- programs
CREATE TABLE connect."programs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "code" text,
  "active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "programs_pkey" PRIMARY KEY (id),
  CONSTRAINT "programs_tenant_id_code_key" UNIQUE (tenant_id, code),
  CONSTRAINT "programs_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- realized_revenue
CREATE TABLE connect."realized_revenue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "received_on" date NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "currency" text NOT NULL,
  "external_reference" text,
  "note" text,
  "recorded_by" uuid,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "realized_revenue_amount_check" CHECK (((amount > (0)::numeric) AND (amount <= 999999999999.99))),
  CONSTRAINT "realized_revenue_currency_check" CHECK ((currency ~ '^[A-Z]{3}$'::text)),
  CONSTRAINT "realized_revenue_pkey" PRIMARY KEY (id),
  CONSTRAINT "realized_revenue_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- staff_notifications
CREATE TABLE connect."staff_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_at" timestamp with time zone,
  CONSTRAINT "staff_notifications_kind_check" CHECK ((kind = ANY (ARRAY['upcoming'::text, 'overdue'::text]))),
  CONSTRAINT "staff_notifications_pkey" PRIMARY KEY (id),
  CONSTRAINT "staff_notifications_tenant_id_task_id_member_id_kind_key" UNIQUE (tenant_id, task_id, member_id, kind)
);

-- stage_events
CREATE TABLE connect."stage_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "opportunity_id" uuid NOT NULL,
  "from_stage_id" uuid,
  "to_stage_id" uuid NOT NULL,
  "changed_by_membership_id" uuid,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "note" text,
  "pipeline_id" uuid NOT NULL,
  CONSTRAINT "stage_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "stage_events_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- subscriptions
CREATE TABLE connect."subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "status" text NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "external_billing_ref" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subscriptions_check" CHECK (((ends_at IS NULL) OR (ends_at > starts_at))),
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY (id),
  CONSTRAINT "subscriptions_status_check" CHECK ((status = ANY (ARRAY['trial'::text, 'active'::text, 'past_due'::text, 'cancelled'::text, 'expired'::text])))
);

-- tasks
CREATE TABLE connect."tasks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "opportunity_id" uuid,
  "person_id" uuid,
  "assignee_membership_id" uuid,
  "title" text NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "due_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tasks_check" CHECK (((opportunity_id IS NOT NULL) OR (person_id IS NOT NULL))),
  CONSTRAINT "tasks_pkey" PRIMARY KEY (id),
  CONSTRAINT "tasks_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'done'::text, 'cancelled'::text]))),
  CONSTRAINT "tasks_tenant_id_id_key" UNIQUE (tenant_id, id)
);

-- tenants
CREATE TABLE connect."tenants" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "timezone" text DEFAULT 'Asia/Kolkata'::text NOT NULL,
  "default_currency" text DEFAULT 'INR'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tenants_default_currency_check" CHECK ((default_currency ~ '^[A-Z]{3}$'::text)),
  CONSTRAINT "tenants_name_check" CHECK ((length(TRIM(BOTH FROM name)) > 0)),
  CONSTRAINT "tenants_pkey" PRIMARY KEY (id),
  CONSTRAINT "tenants_slug_check" CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
  CONSTRAINT "tenants_slug_key" UNIQUE (slug),
  CONSTRAINT "tenants_status_check" CHECK ((status = ANY (ARRAY['trial'::text, 'active'::text, 'suspended'::text, 'closed'::text])))
);

-- webhook_receipts
CREATE TABLE connect."webhook_receipts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "channel_account_id" uuid NOT NULL,
  "external_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  CONSTRAINT "webhook_receipts_attempts_check" CHECK ((attempts >= 0)),
  CONSTRAINT "webhook_receipts_pkey" PRIMARY KEY (id),
  CONSTRAINT "webhook_receipts_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processed'::text, 'retry'::text, 'failed'::text]))),
  CONSTRAINT "webhook_receipts_tenant_id_channel_account_id_external_even_key" UNIQUE (tenant_id, channel_account_id, external_event_id)
);

-- whatsapp_app_contacts
CREATE TABLE connect."whatsapp_app_contacts" (
  "tenant_id" uuid NOT NULL,
  "channel_account_id" uuid NOT NULL,
  "phone" text NOT NULL,
  "display_name" text,
  "last_event_at" timestamp with time zone NOT NULL,
  "present_in_app" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_app_contacts_phone" CHECK ((phone ~ '^\+[0-9]{8,15}$'::text)),
  CONSTRAINT "whatsapp_app_contacts_pkey" PRIMARY KEY (tenant_id, channel_account_id, phone)
);

-- whatsapp_delivery_events
CREATE TABLE connect."whatsapp_delivery_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "channel_account_id" uuid NOT NULL,
  "external_message_id" text NOT NULL,
  "status" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "failure_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_delivery_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "whatsapp_delivery_events_status_check" CHECK ((status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'failed'::text]))),
  CONSTRAINT "whatsapp_delivery_events_tenant_id_channel_account_id_exter_key" UNIQUE (tenant_id, channel_account_id, external_message_id, status)
);

-- whatsapp_enquiry_triage
CREATE TABLE connect."whatsapp_enquiry_triage" (
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "classification" text NOT NULL,
  "inquiry_id" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_enquiry_triage_check" CHECK ((((classification = 'enquiry'::text) AND (inquiry_id IS NOT NULL)) OR ((classification = 'not_enquiry'::text) AND (inquiry_id IS NULL)))),
  CONSTRAINT "whatsapp_enquiry_triage_classification_check" CHECK ((classification = ANY (ARRAY['enquiry'::text, 'not_enquiry'::text]))),
  CONSTRAINT "whatsapp_enquiry_triage_pkey" PRIMARY KEY (tenant_id, conversation_id)
);

-- whatsapp_history_jobs
CREATE TABLE connect."whatsapp_history_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "channel_account_id" uuid NOT NULL,
  "fingerprint" text NOT NULL,
  "payload" jsonb NOT NULL,
  "state" text DEFAULT 'pending'::text NOT NULL,
  "thread_index" integer DEFAULT 0 NOT NULL,
  "message_index" integer DEFAULT 0 NOT NULL,
  "processed_messages" integer DEFAULT 0 NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "lease_token" uuid,
  "lease_until" timestamp with time zone,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_history_jobs_attempts_check" CHECK ((attempts >= 0)),
  CONSTRAINT "whatsapp_history_jobs_fingerprint_check" CHECK ((fingerprint ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "whatsapp_history_jobs_message_index_check" CHECK ((message_index >= 0)),
  CONSTRAINT "whatsapp_history_jobs_pkey" PRIMARY KEY (id),
  CONSTRAINT "whatsapp_history_jobs_processed_messages_check" CHECK ((processed_messages >= 0)),
  CONSTRAINT "whatsapp_history_jobs_state_check" CHECK ((state = ANY (ARRAY['pending'::text, 'processing'::text, 'retry'::text, 'completed'::text, 'failed'::text]))),
  CONSTRAINT "whatsapp_history_jobs_tenant_id_channel_account_id_fingerpr_key" UNIQUE (tenant_id, channel_account_id, fingerprint),
  CONSTRAINT "whatsapp_history_jobs_thread_index_check" CHECK ((thread_index >= 0))
);

-- whatsapp_send_requests
CREATE TABLE connect."whatsapp_send_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "channel_account_id" uuid NOT NULL,
  "actor_membership_id" uuid NOT NULL,
  "client_request_id" uuid NOT NULL,
  "destination" text NOT NULL,
  "body" text NOT NULL,
  "state" text DEFAULT 'reserved'::text NOT NULL,
  "external_message_id" text,
  "failure_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "whatsapp_send_requests_body_check" CHECK (((length(body) >= 1) AND (length(body) <= 3000))),
  CONSTRAINT "whatsapp_send_requests_pkey" PRIMARY KEY (id),
  CONSTRAINT "whatsapp_send_requests_state_check" CHECK ((state = ANY (ARRAY['reserved'::text, 'accepted'::text, 'rejected'::text, 'unknown'::text]))),
  CONSTRAINT "whatsapp_send_requests_tenant_id_conversation_id_client_req_key" UNIQUE (tenant_id, conversation_id, client_request_id)
);

-- whatsapp_thread_state
CREATE TABLE connect."whatsapp_thread_state" (
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "last_read_at" timestamp with time zone,
  "draft_text" text DEFAULT ''::text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_thread_state_draft_text_check" CHECK ((length(draft_text) <= 3000)),
  CONSTRAINT "whatsapp_thread_state_pkey" PRIMARY KEY (tenant_id, conversation_id, member_id)
);

-- workspace_preferences
CREATE TABLE connect."workspace_preferences" (
  "tenant_id" uuid NOT NULL,
  "interface_mode" text DEFAULT 'simple'::text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_preferences_interface_mode_check" CHECK ((interface_mode = ANY (ARRAY['simple'::text, 'advanced'::text]))),
  CONSTRAINT "workspace_preferences_pkey" PRIMARY KEY (tenant_id)
);

-- Foreign keys are applied after all tables to support cross-references.
ALTER TABLE connect."activities" ADD CONSTRAINT "activities_tenant_id_actor_membership_id_fkey" FOREIGN KEY (tenant_id, actor_membership_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."activities" ADD CONSTRAINT "activities_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."activities" ADD CONSTRAINT "activities_tenant_id_opportunity_id_fkey" FOREIGN KEY (tenant_id, opportunity_id) REFERENCES connect.opportunities(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."activities" ADD CONSTRAINT "activities_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."appointments" ADD CONSTRAINT "appointments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."appointments" ADD CONSTRAINT "appointments_tenant_id_opportunity_id_fkey" FOREIGN KEY (tenant_id, opportunity_id) REFERENCES connect.opportunities(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."appointments" ADD CONSTRAINT "appointments_tenant_id_owner_membership_id_fkey" FOREIGN KEY (tenant_id, owner_membership_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."appointments" ADD CONSTRAINT "appointments_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."attribution" ADD CONSTRAINT "attribution_tenant_id_campaign_id_fkey" FOREIGN KEY (tenant_id, campaign_id) REFERENCES connect.campaigns(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."attribution" ADD CONSTRAINT "attribution_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."attribution" ADD CONSTRAINT "attribution_tenant_id_opportunity_id_fkey" FOREIGN KEY (tenant_id, opportunity_id) REFERENCES connect.opportunities(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."attribution" ADD CONSTRAINT "attribution_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."audit_events" ADD CONSTRAINT "audit_events_tenant_id_actor_membership_id_fkey" FOREIGN KEY (tenant_id, actor_membership_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."audit_events" ADD CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."automation_settings" ADD CONSTRAINT "automation_settings_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."campaign_spend" ADD CONSTRAINT "campaign_spend_tenant_id_campaign_id_fkey" FOREIGN KEY (tenant_id, campaign_id) REFERENCES connect.campaigns(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."campaign_spend" ADD CONSTRAINT "campaign_spend_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."campaign_spend" ADD CONSTRAINT "campaign_spend_tenant_id_recorded_by_fkey" FOREIGN KEY (tenant_id, recorded_by) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."campaigns" ADD CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."channel_accounts" ADD CONSTRAINT "channel_accounts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."consent_events" ADD CONSTRAINT "consent_events_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."consent_events" ADD CONSTRAINT "consent_events_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."contact_import_batches" ADD CONSTRAINT "contact_import_batches_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id);
ALTER TABLE connect."contact_import_details" ADD CONSTRAINT "contact_import_details_tenant_id_source_batch_id_fkey" FOREIGN KEY (tenant_id, source_batch_id) REFERENCES connect.contact_import_batches(tenant_id, id);
ALTER TABLE connect."contact_import_items" ADD CONSTRAINT "contact_import_items_tenant_id_batch_id_fkey" FOREIGN KEY (tenant_id, batch_id) REFERENCES connect.contact_import_batches(tenant_id, id);
ALTER TABLE connect."contact_methods" ADD CONSTRAINT "contact_methods_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."contact_methods" ADD CONSTRAINT "contact_methods_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."contact_owners" ADD CONSTRAINT "contact_owners_tenant_id_assigned_by_membership_id_fkey" FOREIGN KEY (tenant_id, assigned_by_membership_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE SET NULL (assigned_by_membership_id);
ALTER TABLE connect."contact_owners" ADD CONSTRAINT "contact_owners_tenant_id_owner_membership_id_fkey" FOREIGN KEY (tenant_id, owner_membership_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."contact_owners" ADD CONSTRAINT "contact_owners_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE connect."contact_profiles" ADD CONSTRAINT "contact_profiles_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id);
ALTER TABLE connect."contact_saved_segments" ADD CONSTRAINT "contact_saved_segments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id);
ALTER TABLE connect."conversations" ADD CONSTRAINT "conversations_assigned_membership_fk" FOREIGN KEY (tenant_id, assigned_membership_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."conversations" ADD CONSTRAINT "conversations_tenant_id_channel_account_id_fkey" FOREIGN KEY (tenant_id, channel_account_id) REFERENCES connect.channel_accounts(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."conversations" ADD CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."conversations" ADD CONSTRAINT "conversations_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."email_conversation_recipients" ADD CONSTRAINT "email_conversation_recipients_tenant_id_conversation_id_fkey" FOREIGN KEY (tenant_id, conversation_id) REFERENCES connect.conversations(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE connect."email_message_headers" ADD CONSTRAINT "email_message_headers_tenant_id_message_id_fkey" FOREIGN KEY (tenant_id, message_id) REFERENCES connect.messages(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE connect."enquiry_categories" ADD CONSTRAINT "enquiry_categories_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE CASCADE;
ALTER TABLE connect."entitlements" ADD CONSTRAINT "entitlements_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES connect.plans(id) ON DELETE RESTRICT;
ALTER TABLE connect."external_links" ADD CONSTRAINT "external_links_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."external_links" ADD CONSTRAINT "external_links_tenant_id_integration_id_fkey" FOREIGN KEY (tenant_id, integration_id) REFERENCES connect.integration_connections(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."form_keys" ADD CONSTRAINT "form_keys_tenant_id_channel_account_id_fkey" FOREIGN KEY (tenant_id, channel_account_id) REFERENCES connect.channel_accounts(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."form_keys" ADD CONSTRAINT "form_keys_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."household_members" ADD CONSTRAINT "household_members_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."household_members" ADD CONSTRAINT "household_members_tenant_id_household_id_fkey" FOREIGN KEY (tenant_id, household_id) REFERENCES connect.households(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."household_members" ADD CONSTRAINT "household_members_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."households" ADD CONSTRAINT "households_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."inquiries" ADD CONSTRAINT "connect_inquiry_category_fk" FOREIGN KEY (tenant_id, category_id) REFERENCES connect.enquiry_categories(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."inquiries" ADD CONSTRAINT "inquiries_tenant_id_channel_account_id_fkey" FOREIGN KEY (tenant_id, channel_account_id) REFERENCES connect.channel_accounts(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."inquiries" ADD CONSTRAINT "inquiries_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."inquiries" ADD CONSTRAINT "inquiries_tenant_id_opportunity_id_fkey" FOREIGN KEY (tenant_id, opportunity_id) REFERENCES connect.opportunities(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."inquiries" ADD CONSTRAINT "inquiries_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."integration_connections" ADD CONSTRAINT "integration_connections_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE connect."invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE connect."message_attachments" ADD CONSTRAINT "message_attachments_tenant_id_message_id_fkey" FOREIGN KEY (tenant_id, message_id) REFERENCES connect.messages(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE connect."messages" ADD CONSTRAINT "messages_tenant_id_conversation_id_fkey" FOREIGN KEY (tenant_id, conversation_id) REFERENCES connect.conversations(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."messages" ADD CONSTRAINT "messages_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunities" ADD CONSTRAINT "opportunities_tenant_id_contact_id_fkey" FOREIGN KEY (tenant_id, contact_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunities" ADD CONSTRAINT "opportunities_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunities" ADD CONSTRAINT "opportunities_tenant_id_organization_id_fkey" FOREIGN KEY (tenant_id, organization_id) REFERENCES connect.organizations(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunities" ADD CONSTRAINT "opportunities_tenant_id_owner_membership_id_fkey" FOREIGN KEY (tenant_id, owner_membership_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunities" ADD CONSTRAINT "opportunities_tenant_id_pipeline_id_fkey" FOREIGN KEY (tenant_id, pipeline_id) REFERENCES connect.pipelines(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunities" ADD CONSTRAINT "opportunities_tenant_id_pipeline_id_stage_id_fkey" FOREIGN KEY (tenant_id, pipeline_id, stage_id) REFERENCES connect.pipeline_stages(tenant_id, pipeline_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunity_people" ADD CONSTRAINT "opportunity_people_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunity_people" ADD CONSTRAINT "opportunity_people_tenant_id_opportunity_id_fkey" FOREIGN KEY (tenant_id, opportunity_id) REFERENCES connect.opportunities(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunity_people" ADD CONSTRAINT "opportunity_people_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunity_programs" ADD CONSTRAINT "opportunity_programs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunity_programs" ADD CONSTRAINT "opportunity_programs_tenant_id_opportunity_id_fkey" FOREIGN KEY (tenant_id, opportunity_id) REFERENCES connect.opportunities(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."opportunity_programs" ADD CONSTRAINT "opportunity_programs_tenant_id_program_id_fkey" FOREIGN KEY (tenant_id, program_id) REFERENCES connect.programs(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."organization_contacts" ADD CONSTRAINT "organization_contacts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."organization_contacts" ADD CONSTRAINT "organization_contacts_tenant_id_organization_id_fkey" FOREIGN KEY (tenant_id, organization_id) REFERENCES connect.organizations(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."organization_contacts" ADD CONSTRAINT "organization_contacts_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."organizations" ADD CONSTRAINT "organizations_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."outbox" ADD CONSTRAINT "outbox_tenant_id_conversation_id_fkey" FOREIGN KEY (tenant_id, conversation_id) REFERENCES connect.conversations(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."outbox" ADD CONSTRAINT "outbox_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."people" ADD CONSTRAINT "people_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."person_relations" ADD CONSTRAINT "person_relations_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."person_relations" ADD CONSTRAINT "person_relations_tenant_id_from_person_id_fkey" FOREIGN KEY (tenant_id, from_person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."person_relations" ADD CONSTRAINT "person_relations_tenant_id_to_person_id_fkey" FOREIGN KEY (tenant_id, to_person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."person_roles" ADD CONSTRAINT "person_roles_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."person_roles" ADD CONSTRAINT "person_roles_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."pipeline_stages" ADD CONSTRAINT "pipeline_stages_tenant_id_pipeline_id_fkey" FOREIGN KEY (tenant_id, pipeline_id) REFERENCES connect.pipelines(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."pipelines" ADD CONSTRAINT "pipelines_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."portal_admission_handoffs" ADD CONSTRAINT "portal_admission_handoffs_acceptance_recorded_by_fkey" FOREIGN KEY (acceptance_recorded_by) REFERENCES auth.users(id);
ALTER TABLE connect."portal_admission_handoffs" ADD CONSTRAINT "portal_admission_handoffs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."portal_admission_handoffs" ADD CONSTRAINT "portal_admission_handoffs_tenant_id_learner_person_id_fkey" FOREIGN KEY (tenant_id, learner_person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."portal_admission_handoffs" ADD CONSTRAINT "portal_admission_handoffs_tenant_id_opportunity_id_fkey" FOREIGN KEY (tenant_id, opportunity_id) REFERENCES connect.opportunities(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."portal_demo_followup_receipts" ADD CONSTRAINT "portal_demo_followup_receipts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."portal_demo_integrations" ADD CONSTRAINT "portal_demo_integrations_installed_by_fkey" FOREIGN KEY (installed_by) REFERENCES auth.users(id);
ALTER TABLE connect."portal_demo_integrations" ADD CONSTRAINT "portal_demo_integrations_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."portal_demo_links" ADD CONSTRAINT "portal_demo_links_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE connect."portal_demo_links" ADD CONSTRAINT "portal_demo_links_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."portal_demo_links" ADD CONSTRAINT "portal_demo_links_tenant_id_opportunity_id_fkey" FOREIGN KEY (tenant_id, opportunity_id) REFERENCES connect.opportunities(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."portal_demo_links" ADD CONSTRAINT "portal_demo_links_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."portal_lifecycle_summaries" ADD CONSTRAINT "portal_lifecycle_summaries_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE CASCADE;
ALTER TABLE connect."portal_renewal_signals" ADD CONSTRAINT "portal_renewal_signals_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE CASCADE;
ALTER TABLE connect."programs" ADD CONSTRAINT "programs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."realized_revenue" ADD CONSTRAINT "realized_revenue_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."realized_revenue" ADD CONSTRAINT "realized_revenue_tenant_id_opportunity_id_fkey" FOREIGN KEY (tenant_id, opportunity_id) REFERENCES connect.opportunities(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."realized_revenue" ADD CONSTRAINT "realized_revenue_tenant_id_recorded_by_fkey" FOREIGN KEY (tenant_id, recorded_by) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."staff_notifications" ADD CONSTRAINT "staff_notifications_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."staff_notifications" ADD CONSTRAINT "staff_notifications_tenant_id_member_id_fkey" FOREIGN KEY (tenant_id, member_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."staff_notifications" ADD CONSTRAINT "staff_notifications_tenant_id_task_id_fkey" FOREIGN KEY (tenant_id, task_id) REFERENCES connect.tasks(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."stage_events" ADD CONSTRAINT "connect_stage_event_from_stage_fkey" FOREIGN KEY (tenant_id, pipeline_id, from_stage_id) REFERENCES connect.pipeline_stages(tenant_id, pipeline_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."stage_events" ADD CONSTRAINT "connect_stage_event_opportunity_fkey" FOREIGN KEY (tenant_id, pipeline_id, opportunity_id) REFERENCES connect.opportunities(tenant_id, pipeline_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."stage_events" ADD CONSTRAINT "connect_stage_event_to_stage_fkey" FOREIGN KEY (tenant_id, pipeline_id, to_stage_id) REFERENCES connect.pipeline_stages(tenant_id, pipeline_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."stage_events" ADD CONSTRAINT "stage_events_tenant_id_changed_by_membership_id_fkey" FOREIGN KEY (tenant_id, changed_by_membership_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES connect.plans(id) ON DELETE RESTRICT;
ALTER TABLE connect."subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."tasks" ADD CONSTRAINT "tasks_tenant_id_assignee_membership_id_fkey" FOREIGN KEY (tenant_id, assignee_membership_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."tasks" ADD CONSTRAINT "tasks_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."tasks" ADD CONSTRAINT "tasks_tenant_id_opportunity_id_fkey" FOREIGN KEY (tenant_id, opportunity_id) REFERENCES connect.opportunities(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."tasks" ADD CONSTRAINT "tasks_tenant_id_person_id_fkey" FOREIGN KEY (tenant_id, person_id) REFERENCES connect.people(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."webhook_receipts" ADD CONSTRAINT "webhook_receipts_tenant_id_channel_account_id_fkey" FOREIGN KEY (tenant_id, channel_account_id) REFERENCES connect.channel_accounts(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."webhook_receipts" ADD CONSTRAINT "webhook_receipts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE RESTRICT;
ALTER TABLE connect."whatsapp_app_contacts" ADD CONSTRAINT "whatsapp_app_contacts_tenant_id_channel_account_id_fkey" FOREIGN KEY (tenant_id, channel_account_id) REFERENCES connect.channel_accounts(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."whatsapp_delivery_events" ADD CONSTRAINT "whatsapp_delivery_events_tenant_id_channel_account_id_fkey" FOREIGN KEY (tenant_id, channel_account_id) REFERENCES connect.channel_accounts(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."whatsapp_enquiry_triage" ADD CONSTRAINT "whatsapp_enquiry_triage_tenant_id_conversation_id_fkey" FOREIGN KEY (tenant_id, conversation_id) REFERENCES connect.conversations(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE connect."whatsapp_enquiry_triage" ADD CONSTRAINT "whatsapp_enquiry_triage_tenant_id_inquiry_id_fkey" FOREIGN KEY (tenant_id, inquiry_id) REFERENCES connect.inquiries(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."whatsapp_history_jobs" ADD CONSTRAINT "whatsapp_history_jobs_tenant_id_channel_account_id_fkey" FOREIGN KEY (tenant_id, channel_account_id) REFERENCES connect.channel_accounts(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."whatsapp_send_requests" ADD CONSTRAINT "whatsapp_send_requests_tenant_id_actor_membership_id_fkey" FOREIGN KEY (tenant_id, actor_membership_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."whatsapp_send_requests" ADD CONSTRAINT "whatsapp_send_requests_tenant_id_channel_account_id_fkey" FOREIGN KEY (tenant_id, channel_account_id) REFERENCES connect.channel_accounts(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."whatsapp_send_requests" ADD CONSTRAINT "whatsapp_send_requests_tenant_id_conversation_id_fkey" FOREIGN KEY (tenant_id, conversation_id) REFERENCES connect.conversations(tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE connect."whatsapp_thread_state" ADD CONSTRAINT "whatsapp_thread_state_tenant_id_conversation_id_fkey" FOREIGN KEY (tenant_id, conversation_id) REFERENCES connect.conversations(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE connect."whatsapp_thread_state" ADD CONSTRAINT "whatsapp_thread_state_tenant_id_member_id_fkey" FOREIGN KEY (tenant_id, member_id) REFERENCES connect.memberships(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE connect."workspace_preferences" ADD CONSTRAINT "workspace_preferences_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES connect.tenants(id) ON DELETE CASCADE;

-- Final indexes.
CREATE INDEX connect_activity_timeline_idx ON connect.activities USING btree (tenant_id, person_id, occurred_at DESC);
CREATE INDEX connect_appointments_upcoming_idx ON connect.appointments USING btree (tenant_id, starts_at);
CREATE UNIQUE INDEX connect_one_campaign_per_opportunity ON connect.attribution USING btree (tenant_id, opportunity_id) WHERE ((opportunity_id IS NOT NULL) AND (campaign_id IS NOT NULL));
CREATE INDEX connect_audit_timeline_idx ON connect.audit_events USING btree (tenant_id, occurred_at DESC);
CREATE INDEX connect_campaign_spend_period ON connect.campaign_spend USING btree (tenant_id, spent_on, campaign_id);
CREATE UNIQUE INDEX connect_channel_global_identity ON connect.channel_accounts USING btree (provider, lower(external_account_id)) WHERE (external_account_id IS NOT NULL);
CREATE UNIQUE INDEX idx_connect_whatsapp_active_number_global ON connect.channel_accounts USING btree (provider, external_account_id) WHERE ((provider = 'whatsapp'::text) AND (status = 'active'::text) AND (external_account_id IS NOT NULL));
CREATE INDEX connect_consent_latest_idx ON connect.consent_events USING btree (tenant_id, person_id, channel, purpose, recorded_at DESC);
CREATE INDEX contact_import_batches_tenant_created ON connect.contact_import_batches USING btree (tenant_id, created_at DESC);
CREATE INDEX contact_import_items_batch ON connect.contact_import_items USING btree (tenant_id, batch_id);
CREATE INDEX connect_contact_lookup_idx ON connect.contact_methods USING btree (tenant_id, kind, normalized_value);
CREATE UNIQUE INDEX connect_primary_contact_idx ON connect.contact_methods USING btree (tenant_id, person_id, kind) WHERE is_primary;
CREATE INDEX idx_connect_contact_owners_assigned_by ON connect.contact_owners USING btree (tenant_id, assigned_by_membership_id);
CREATE INDEX idx_connect_contact_owners_owner ON connect.contact_owners USING btree (tenant_id, owner_membership_id);
CREATE INDEX contact_profiles_city_idx ON connect.contact_profiles USING btree (tenant_id, lower(city));
CREATE INDEX contact_profiles_tags_gin ON connect.contact_profiles USING gin (tags);
CREATE INDEX contact_segments_tenant_idx ON connect.contact_saved_segments USING btree (tenant_id, created_at DESC);
CREATE UNIQUE INDEX connect_conversation_external_idx ON connect.conversations USING btree (tenant_id, channel_account_id, external_thread_id) WHERE (external_thread_id IS NOT NULL);
CREATE INDEX idx_connect_conv_recent ON connect.conversations USING btree (tenant_id, channel_account_id, last_message_at DESC NULLS LAST);
CREATE INDEX idx_connect_wa_conversation_assignee ON connect.conversations USING btree (tenant_id, assigned_membership_id);
CREATE UNIQUE INDEX connect_enquiry_category_label ON connect.enquiry_categories USING btree (tenant_id, lower(btrim(label)));
CREATE UNIQUE INDEX connect_household_primary_idx ON connect.household_members USING btree (tenant_id, household_id) WHERE is_primary_contact;
CREATE INDEX connect_inquiries_category ON connect.inquiries USING btree (tenant_id, category_id, received_at DESC);
CREATE UNIQUE INDEX connect_inquiry_external_idx ON connect.inquiries USING btree (tenant_id, channel_account_id, external_event_id) WHERE (external_event_id IS NOT NULL);
CREATE UNIQUE INDEX connect_pending_invite_idx ON connect.invitations USING btree (tenant_id, email) WHERE ((accepted_at IS NULL) AND (revoked_at IS NULL));
CREATE INDEX connect_memberships_user_idx ON connect.memberships USING btree (user_id, tenant_id) WHERE (status = 'active'::text);
CREATE INDEX connect_message_history_idx ON connect.messages USING btree (tenant_id, conversation_id, occurred_at DESC);
CREATE UNIQUE INDEX connect_message_idempotency_idx ON connect.messages USING btree (tenant_id, conversation_id, external_message_id) WHERE (external_message_id IS NOT NULL);
CREATE UNIQUE INDEX idx_connect_msg_external_id ON connect.messages USING btree (tenant_id, conversation_id, external_message_id) WHERE (external_message_id IS NOT NULL);
CREATE INDEX idx_connect_msg_recent ON connect.messages USING btree (tenant_id, conversation_id, occurred_at DESC);
CREATE INDEX connect_opportunities_board_idx ON connect.opportunities USING btree (tenant_id, pipeline_id, stage_id, updated_at DESC);
CREATE INDEX connect_outbox_pending_idx ON connect.outbox USING btree (tenant_id, status, next_attempt_at) WHERE (status = ANY (ARRAY['queued'::text, 'failed'::text]));
CREATE INDEX connect_people_name_idx ON connect.people USING btree (tenant_id, lower(full_name));
CREATE UNIQUE INDEX connect_handoff_enrollment_unique ON connect.portal_admission_handoffs USING btree (portal_enrollment_id) WHERE (portal_enrollment_id IS NOT NULL);
CREATE UNIQUE INDEX connect_handoff_one_active_offer ON connect.portal_admission_handoffs USING btree (tenant_id, opportunity_id) WHERE (status <> 'revoked'::text);
CREATE INDEX connect_handoff_opportunity_idx ON connect.portal_admission_handoffs USING btree (tenant_id, opportunity_id, created_at DESC);
CREATE UNIQUE INDEX connect_handoff_submission_unique ON connect.portal_admission_handoffs USING btree (onboarding_submission_id) WHERE (onboarding_submission_id IS NOT NULL);
CREATE UNIQUE INDEX connect_portal_single_active_integration ON connect.portal_demo_integrations USING btree (status) WHERE (status = 'active'::text);
CREATE INDEX portal_demo_links_tenant_opportunity_idx ON connect.portal_demo_links USING btree (tenant_id, opportunity_id, created_at DESC);
CREATE INDEX portal_lifecycle_tenant_renewal_idx ON connect.portal_lifecycle_summaries USING btree (tenant_id, renewal_reason);
CREATE INDEX portal_renewal_signals_open_idx ON connect.portal_renewal_signals USING btree (tenant_id, active, status);
CREATE INDEX connect_realized_revenue_period ON connect.realized_revenue USING btree (tenant_id, received_on, opportunity_id);
CREATE UNIQUE INDEX connect_revenue_external_unique ON connect.realized_revenue USING btree (tenant_id, external_reference) WHERE (external_reference IS NOT NULL);
CREATE INDEX connect_staff_notifications_inbox_idx ON connect.staff_notifications USING btree (tenant_id, member_id, created_at DESC);
CREATE INDEX connect_stage_events_idx ON connect.stage_events USING btree (tenant_id, opportunity_id, changed_at DESC);
CREATE UNIQUE INDEX connect_one_current_subscription_idx ON connect.subscriptions USING btree (tenant_id) WHERE (status = ANY (ARRAY['trial'::text, 'active'::text, 'past_due'::text]));
CREATE INDEX connect_task_queue_idx ON connect.tasks USING btree (tenant_id, assignee_membership_id, due_at) WHERE (status = 'open'::text);
CREATE INDEX idx_connect_wa_delivery_pending ON connect.whatsapp_delivery_events USING btree (tenant_id, channel_account_id, external_message_id);
CREATE INDEX idx_connect_wa_history_pending ON connect.whatsapp_history_jobs USING btree (state, next_attempt_at, lease_until);
CREATE INDEX idx_connect_wa_send_requests_status ON connect.whatsapp_send_requests USING btree (tenant_id, state, created_at);
CREATE INDEX idx_connect_wa_state_member ON connect.whatsapp_thread_state USING btree (tenant_id, member_id);

-- Final private access policy.
DO $acl$ DECLARE r record; BEGIN FOR r IN SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='connect' AND c.relkind='r' LOOP EXECUTE format('ALTER TABLE connect.%I ENABLE ROW LEVEL SECURITY',r.relname); EXECUTE format('REVOKE ALL ON TABLE connect.%I FROM PUBLIC,anon,authenticated',r.relname); EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE connect.%I TO service_role',r.relname); END LOOP; END $acl$;
COMMIT;
