-- CANONICAL TASKS SCHEMA: current final definitions captured from development catalog.
-- Creates the final structure directly, without phase-by-phase ALTER patches.
-- Run once against a database with Portal/Auth already installed; no existing tasks schema.
BEGIN;
DO $guard$ BEGIN IF to_regnamespace('tasks') IS NOT NULL THEN RAISE EXCEPTION 'tasks schema exists'; END IF; END $guard$;
CREATE SCHEMA tasks;
REVOKE ALL ON SCHEMA tasks FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA tasks TO service_role;

-- accounts
CREATE TABLE tasks."accounts" (
  "user_id" uuid NOT NULL,
  "display_name" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "plan" text DEFAULT 'free'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "accounts_display_name_check" CHECK ((length(display_name) <= 100)),
  CONSTRAINT "accounts_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "accounts_plan_check" CHECK ((plan = 'free'::text)),
  CONSTRAINT "accounts_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text])))
);

-- activity
CREATE TABLE tasks."activity" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "action" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "activity_action_check" CHECK (((length(action) >= 1) AND (length(action) <= 60))),
  CONSTRAINT "activity_pkey" PRIMARY KEY (id)
);

-- areas
CREATE TABLE tasks."areas" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "color" text DEFAULT 'blue'::text NOT NULL,
  "icon" text DEFAULT 'folder'::text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "areas_color_check" CHECK ((color = ANY (ARRAY['slate'::text, 'blue'::text, 'green'::text, 'amber'::text, 'red'::text, 'purple'::text]))),
  CONSTRAINT "areas_icon_check" CHECK (((char_length(icon) >= 1) AND (char_length(icon) <= 40))),
  CONSTRAINT "areas_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 80))),
  CONSTRAINT "areas_owner_user_id_id_key" UNIQUE (owner_user_id, id),
  CONSTRAINT "areas_pkey" PRIMARY KEY (id)
);

-- attachments
CREATE TABLE tasks."attachments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "storage_path" text NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "attachments_byte_size_check" CHECK (((byte_size >= 1) AND (byte_size <= 10485760))),
  CONSTRAINT "attachments_file_name_check" CHECK (((length(file_name) >= 1) AND (length(file_name) <= 250))),
  CONSTRAINT "attachments_pkey" PRIMARY KEY (id),
  CONSTRAINT "attachments_storage_path_key" UNIQUE (storage_path)
);

-- categories
CREATE TABLE tasks."categories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "color" text DEFAULT 'slate'::text NOT NULL,
  "icon" text DEFAULT 'folder'::text NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "categories_color_check" CHECK ((color = ANY (ARRAY['slate'::text, 'blue'::text, 'green'::text, 'amber'::text, 'red'::text, 'purple'::text]))),
  CONSTRAINT "categories_icon_check" CHECK (((length(icon) >= 1) AND (length(icon) <= 40))),
  CONSTRAINT "categories_name_check" CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 80))),
  CONSTRAINT "categories_owner_user_id_id_key" UNIQUE (owner_user_id, id),
  CONSTRAINT "categories_pkey" PRIMARY KEY (id)
);

-- comments
CREATE TABLE tasks."comments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "author_user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "edited_at" timestamp with time zone,
  CONSTRAINT "comments_body_check" CHECK (((length(btrim(body)) >= 1) AND (length(btrim(body)) <= 4000))),
  CONSTRAINT "comments_pkey" PRIMARY KEY (id)
);

-- focus_commitments
CREATE TABLE tasks."focus_commitments" (
  "owner_user_id" uuid NOT NULL,
  "area_id" uuid NOT NULL,
  "target_sessions" smallint NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "focus_commitments_pkey" PRIMARY KEY (owner_user_id, area_id),
  CONSTRAINT "focus_commitments_target_sessions_check" CHECK (((target_sessions >= 1) AND (target_sessions <= 14)))
);

-- focus_sessions
CREATE TABLE tasks."focus_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "mode" text DEFAULT 'timebox'::text NOT NULL,
  "state" text DEFAULT 'running'::text NOT NULL,
  "planned_minutes" integer NOT NULL,
  "elapsed_seconds" integer DEFAULT 0 NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resumed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone,
  "outcome" text,
  "extension_count" smallint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "focus_end_consistency" CHECK (((state = 'ended'::text) = (ended_at IS NOT NULL))),
  CONSTRAINT "focus_sessions_elapsed_seconds_check" CHECK (((elapsed_seconds >= 0) AND (elapsed_seconds <= 604800))),
  CONSTRAINT "focus_sessions_extension_count_check" CHECK (((extension_count >= 0) AND (extension_count <= 50))),
  CONSTRAINT "focus_sessions_mode_check" CHECK ((mode = ANY (ARRAY['timebox'::text, 'pomodoro'::text, 'stopwatch'::text, 'five_minutes'::text]))),
  CONSTRAINT "focus_sessions_outcome_check" CHECK ((outcome = ANY (ARRAY['completed'::text, 'parked'::text, 'stopped'::text]))),
  CONSTRAINT "focus_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "focus_sessions_planned_minutes_check" CHECK (((planned_minutes >= 5) AND (planned_minutes <= 240))),
  CONSTRAINT "focus_sessions_state_check" CHECK ((state = ANY (ARRAY['running'::text, 'paused'::text, 'ended'::text])))
);

-- focus_settings
CREATE TABLE tasks."focus_settings" (
  "owner_user_id" uuid NOT NULL,
  "active_project_limit" smallint DEFAULT 2 NOT NULL,
  "daily_focus_minutes" smallint DEFAULT 180 NOT NULL,
  "switch_prompt_enabled" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "focus_settings_active_project_limit_check" CHECK (((active_project_limit >= 1) AND (active_project_limit <= 10))),
  CONSTRAINT "focus_settings_daily_focus_minutes_check" CHECK (((daily_focus_minutes >= 30) AND (daily_focus_minutes <= 600))),
  CONSTRAINT "focus_settings_pkey" PRIMARY KEY (owner_user_id)
);

-- items
CREATE TABLE tasks."items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "category_id" uuid,
  "title" text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'todo'::text NOT NULL,
  "priority" text DEFAULT 'medium'::text NOT NULL,
  "scheduled_date" date,
  "due_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "focus_date" date,
  "focus_rank" smallint,
  "reminder_at" timestamp with time zone,
  "recurrence" text DEFAULT 'none'::text NOT NULL,
  "recurrence_series_id" uuid,
  "recurrence_anchor_day" smallint,
  "workspace_id" uuid,
  "assignee_user_id" uuid,
  "share_with_workspace" boolean DEFAULT false NOT NULL,
  "area_id" uuid,
  "project_id" uuid,
  "board_rank" numeric(14,4) DEFAULT 0 NOT NULL,
  "important" boolean DEFAULT false NOT NULL,
  "estimated_minutes" integer,
  "done_definition" text DEFAULT ''::text NOT NULL,
  "resume_note" text DEFAULT ''::text NOT NULL,
  "waiting_for" text DEFAULT ''::text NOT NULL,
  "followup_date" date,
  "someday" boolean DEFAULT false NOT NULL,
  "reschedule_count" integer DEFAULT 0 NOT NULL,
  "urgent" boolean DEFAULT false NOT NULL,
  CONSTRAINT "items_description_check" CHECK ((length(description) <= 12000)),
  CONSTRAINT "items_focus_rank_check" CHECK (((focus_rank >= 1) AND (focus_rank <= 3))),
  CONSTRAINT "items_pkey" PRIMARY KEY (id),
  CONSTRAINT "items_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
  CONSTRAINT "items_recurrence_anchor_day_check" CHECK (((recurrence_anchor_day >= 1) AND (recurrence_anchor_day <= 31))),
  CONSTRAINT "items_recurrence_check" CHECK ((recurrence = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text, 'monthly'::text]))),
  CONSTRAINT "items_status_check" CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'waiting'::text, 'done'::text]))),
  CONSTRAINT "items_title_check" CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 240))),
  CONSTRAINT "task_assignment_workspace_required" CHECK (((assignee_user_id IS NULL) OR (workspace_id IS NOT NULL))),
  CONSTRAINT "task_completion_consistency" CHECK (((status = 'done'::text) = (completed_at IS NOT NULL))),
  CONSTRAINT "task_personal_not_workspace_visible" CHECK (((workspace_id IS NOT NULL) OR (share_with_workspace = false))),
  CONSTRAINT "task_v2_done_definition_check" CHECK ((char_length(done_definition) <= 2000)),
  CONSTRAINT "task_v2_estimate_check" CHECK (((estimated_minutes >= 1) AND (estimated_minutes <= 1440))),
  CONSTRAINT "task_v2_item_owner_id_unique" UNIQUE (owner_user_id, id),
  CONSTRAINT "task_v2_reschedule_count_bounds" CHECK (((reschedule_count >= 0) AND (reschedule_count <= 1000000))),
  CONSTRAINT "task_v2_resume_note_check" CHECK ((char_length(resume_note) <= 4000)),
  CONSTRAINT "task_v2_waiting_for_check" CHECK ((char_length(waiting_for) <= 500))
);

-- module_links
CREATE TABLE tasks."module_links" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "module" text NOT NULL,
  "resource" text NOT NULL,
  "tenant_id" uuid,
  "resource_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_synced_at" timestamp with time zone,
  CONSTRAINT "module_links_check" CHECK ((((module = 'connect'::text) AND (resource = ANY (ARRAY['crm_task'::text, 'crm_person'::text, 'crm_opportunity'::text])) AND (tenant_id IS NOT NULL)) OR ((module = 'learning'::text) AND (resource = 'schedule_event'::text) AND (tenant_id IS NULL)))),
  CONSTRAINT "module_links_module_check" CHECK ((module = ANY (ARRAY['connect'::text, 'learning'::text]))),
  CONSTRAINT "module_links_owner_user_id_module_resource_tenant_id_resour_key" UNIQUE (owner_user_id, module, resource, tenant_id, resource_id),
  CONSTRAINT "module_links_pkey" PRIMARY KEY (id),
  CONSTRAINT "module_links_resource_check" CHECK ((resource = ANY (ARRAY['crm_task'::text, 'crm_person'::text, 'crm_opportunity'::text, 'schedule_event'::text])))
);

-- notifications
CREATE TABLE tasks."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "recipient_user_id" uuid NOT NULL,
  "task_id" uuid,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "href" text DEFAULT '/tasks'::text NOT NULL,
  "dedupe_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_at" timestamp with time zone,
  CONSTRAINT "notifications_kind_check" CHECK ((kind = ANY (ARRAY['reminder'::text, 'assignment'::text]))),
  CONSTRAINT "notifications_pkey" PRIMARY KEY (id),
  CONSTRAINT "notifications_recipient_user_id_dedupe_key_key" UNIQUE (recipient_user_id, dedupe_key),
  CONSTRAINT "notifications_title_check" CHECK (((length(title) >= 1) AND (length(title) <= 240)))
);

-- parked_ideas
CREATE TABLE tasks."parked_ideas" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "source_task_id" uuid,
  "title" text NOT NULL,
  "state" text DEFAULT 'inbox'::text NOT NULL,
  "converted_task_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "parked_ideas_pkey" PRIMARY KEY (id),
  CONSTRAINT "parked_ideas_state_check" CHECK ((state = ANY (ARRAY['inbox'::text, 'converted'::text, 'dismissed'::text]))),
  CONSTRAINT "parked_ideas_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 300)))
);

-- projects
CREATE TABLE tasks."projects" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "area_id" uuid,
  "name" text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "target_date" date,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "projects_description_check" CHECK ((char_length(description) <= 4000)),
  CONSTRAINT "projects_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 160))),
  CONSTRAINT "projects_owner_user_id_id_key" UNIQUE (owner_user_id, id),
  CONSTRAINT "projects_pkey" PRIMARY KEY (id),
  CONSTRAINT "projects_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text])))
);

-- reminder_deliveries
CREATE TABLE tasks."reminder_deliveries" (
  "task_id" uuid NOT NULL,
  "reminder_at" timestamp with time zone NOT NULL,
  "delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "reminder_deliveries_pkey" PRIMARY KEY (task_id, reminder_at)
);

-- subtasks
CREATE TABLE tasks."subtasks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "done" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subtasks_pkey" PRIMARY KEY (id),
  CONSTRAINT "subtasks_task_id_id_key" UNIQUE (task_id, id),
  CONSTRAINT "subtasks_title_check" CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 240)))
);

-- task_collaborators
CREATE TABLE tasks."task_collaborators" (
  "task_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "permission" text NOT NULL,
  "granted_by" uuid NOT NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "task_collaborators_permission_check" CHECK ((permission = ANY (ARRAY['view'::text, 'edit'::text]))),
  CONSTRAINT "task_collaborators_pkey" PRIMARY KEY (task_id, user_id)
);

-- user_preferences
CREATE TABLE tasks."user_preferences" (
  "user_id" uuid NOT NULL,
  "timezone" text DEFAULT 'Asia/Kolkata'::text NOT NULL,
  "week_starts_on" smallint DEFAULT 1 NOT NULL,
  "focus_limit" smallint DEFAULT 3 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_preferences_focus_limit_check" CHECK (((focus_limit >= 1) AND (focus_limit <= 10))),
  CONSTRAINT "user_preferences_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "user_preferences_timezone_check" CHECK (((length(timezone) >= 1) AND (length(timezone) <= 80))),
  CONSTRAINT "user_preferences_week_starts_on_check" CHECK (((week_starts_on >= 0) AND (week_starts_on <= 6)))
);

-- workspace_invitations
CREATE TABLE tasks."workspace_invitations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "invited_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
  "accepted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "workspace_invitations_email_check" CHECK (((length(btrim(email)) >= 3) AND (length(btrim(email)) <= 254))),
  CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY (id),
  CONSTRAINT "workspace_invitations_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);

-- workspace_members
CREATE TABLE tasks."workspace_members" (
  "workspace_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_members_pkey" PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT "workspace_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
);

-- workspaces
CREATE TABLE tasks."workspaces" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "workspaces_name_check" CHECK (((length(btrim(name)) >= 2) AND (length(btrim(name)) <= 100))),
  CONSTRAINT "workspaces_pkey" PRIMARY KEY (id)
);

-- Deferred foreign keys resolve circular and cross-module dependencies.
ALTER TABLE tasks."accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."activity" ADD CONSTRAINT "activity_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE tasks."activity" ADD CONSTRAINT "activity_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks.items(id) ON DELETE CASCADE;
ALTER TABLE tasks."areas" ADD CONSTRAINT "areas_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."attachments" ADD CONSTRAINT "attachments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks.items(id) ON DELETE CASCADE;
ALTER TABLE tasks."attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE tasks."categories" ADD CONSTRAINT "categories_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."comments" ADD CONSTRAINT "comments_author_user_id_fkey" FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE tasks."comments" ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks.items(id) ON DELETE CASCADE;
ALTER TABLE tasks."focus_commitments" ADD CONSTRAINT "focus_commitment_owned_area" FOREIGN KEY (owner_user_id, area_id) REFERENCES tasks.areas(owner_user_id, id) ON DELETE CASCADE;
ALTER TABLE tasks."focus_commitments" ADD CONSTRAINT "focus_commitments_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."focus_sessions" ADD CONSTRAINT "focus_sessions_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."focus_sessions" ADD CONSTRAINT "focus_task_owner" FOREIGN KEY (owner_user_id, task_id) REFERENCES tasks.items(owner_user_id, id) ON DELETE CASCADE;
ALTER TABLE tasks."focus_settings" ADD CONSTRAINT "focus_settings_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."items" ADD CONSTRAINT "items_assignee_user_id_fkey" FOREIGN KEY (assignee_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE tasks."items" ADD CONSTRAINT "items_created_by_user_id_fkey" FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE tasks."items" ADD CONSTRAINT "items_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."items" ADD CONSTRAINT "items_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES tasks.workspaces(id) ON DELETE RESTRICT;
ALTER TABLE tasks."items" ADD CONSTRAINT "task_category_same_owner" FOREIGN KEY (owner_user_id, category_id) REFERENCES tasks.categories(owner_user_id, id) ON DELETE RESTRICT;
ALTER TABLE tasks."items" ADD CONSTRAINT "task_v2_area_owner" FOREIGN KEY (owner_user_id, area_id) REFERENCES tasks.areas(owner_user_id, id) ON DELETE RESTRICT;
ALTER TABLE tasks."items" ADD CONSTRAINT "task_v2_project_owner" FOREIGN KEY (owner_user_id, project_id) REFERENCES tasks.projects(owner_user_id, id) ON DELETE RESTRICT;
ALTER TABLE tasks."module_links" ADD CONSTRAINT "module_links_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id);
ALTER TABLE tasks."module_links" ADD CONSTRAINT "module_links_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks.items(id) ON DELETE CASCADE;
ALTER TABLE tasks."notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."notifications" ADD CONSTRAINT "notifications_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks.items(id) ON DELETE SET NULL;
ALTER TABLE tasks."parked_ideas" ADD CONSTRAINT "parked_converted_owner" FOREIGN KEY (owner_user_id, converted_task_id) REFERENCES tasks.items(owner_user_id, id) ON DELETE SET NULL (converted_task_id);
ALTER TABLE tasks."parked_ideas" ADD CONSTRAINT "parked_ideas_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."parked_ideas" ADD CONSTRAINT "parked_source_owner" FOREIGN KEY (owner_user_id, source_task_id) REFERENCES tasks.items(owner_user_id, id) ON DELETE SET NULL (source_task_id);
ALTER TABLE tasks."projects" ADD CONSTRAINT "projects_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."projects" ADD CONSTRAINT "task_v2_project_area_owner" FOREIGN KEY (owner_user_id, area_id) REFERENCES tasks.areas(owner_user_id, id) ON DELETE RESTRICT;
ALTER TABLE tasks."reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks.items(id) ON DELETE CASCADE;
ALTER TABLE tasks."subtasks" ADD CONSTRAINT "subtasks_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."subtasks" ADD CONSTRAINT "subtasks_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks.items(id) ON DELETE CASCADE;
ALTER TABLE tasks."task_collaborators" ADD CONSTRAINT "task_collaborators_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES auth.users(id);
ALTER TABLE tasks."task_collaborators" ADD CONSTRAINT "task_collaborators_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks.items(id) ON DELETE CASCADE;
ALTER TABLE tasks."task_collaborators" ADD CONSTRAINT "task_collaborators_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id);
ALTER TABLE tasks."workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES tasks.workspaces(id) ON DELETE CASCADE;
ALTER TABLE tasks."workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tasks."workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES tasks.workspaces(id) ON DELETE CASCADE;
ALTER TABLE tasks."workspaces" ADD CONSTRAINT "workspaces_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- Final indexes, not historical index patches.
CREATE INDEX task_activity_task_time ON tasks.activity USING btree (task_id, created_at DESC);
CREATE UNIQUE INDEX task_v2_area_active_name ON tasks.areas USING btree (owner_user_id, lower(name)) WHERE (archived_at IS NULL);
CREATE INDEX task_v2_area_owner_sort ON tasks.areas USING btree (owner_user_id, sort_order) WHERE (archived_at IS NULL);
CREATE INDEX task_attachments_task ON tasks.attachments USING btree (task_id, created_at);
CREATE UNIQUE INDEX task_categories_unique_active_name ON tasks.categories USING btree (owner_user_id, lower(name)) WHERE (archived_at IS NULL);
CREATE INDEX task_comments_task_time ON tasks.comments USING btree (task_id, created_at);
CREATE UNIQUE INDEX focus_one_active_session ON tasks.focus_sessions USING btree (owner_user_id) WHERE (state = ANY (ARRAY['running'::text, 'paused'::text]));
CREATE INDEX focus_owner_history ON tasks.focus_sessions USING btree (owner_user_id, created_at DESC);
CREATE INDEX focus_task_history ON tasks.focus_sessions USING btree (task_id, started_at DESC);
CREATE INDEX task_items_assignee ON tasks.items USING btree (assignee_user_id, status) WHERE (archived_at IS NULL);
CREATE INDEX task_items_owner_due ON tasks.items USING btree (owner_user_id, due_at) WHERE (archived_at IS NULL);
CREATE INDEX task_items_owner_status_date ON tasks.items USING btree (owner_user_id, status, scheduled_date) WHERE (archived_at IS NULL);
CREATE INDEX task_items_owner_updated ON tasks.items USING btree (owner_user_id, updated_at DESC);
CREATE INDEX task_items_workspace ON tasks.items USING btree (workspace_id, status) WHERE (archived_at IS NULL);
CREATE INDEX task_v2_items_area ON tasks.items USING btree (owner_user_id, area_id, status, board_rank) WHERE (archived_at IS NULL);
CREATE INDEX task_v2_items_followup ON tasks.items USING btree (owner_user_id, followup_date) WHERE ((status = 'waiting'::text) AND (archived_at IS NULL));
CREATE INDEX task_v2_items_plan ON tasks.items USING btree (owner_user_id, scheduled_date, someday) WHERE ((archived_at IS NULL) AND (status <> 'done'::text));
CREATE INDEX task_v2_items_project ON tasks.items USING btree (owner_user_id, project_id, status, board_rank) WHERE (archived_at IS NULL);
CREATE INDEX task_v2_matrix_flags ON tasks.items USING btree (owner_user_id, important, urgent) WHERE ((archived_at IS NULL) AND (status <> 'done'::text));
CREATE INDEX tasks_due_reminder ON tasks.items USING btree (reminder_at) WHERE ((reminder_at IS NOT NULL) AND (status <> 'done'::text) AND (archived_at IS NULL));
CREATE UNIQUE INDEX tasks_focus_order ON tasks.items USING btree (owner_user_id, focus_date, focus_rank) WHERE ((focus_rank IS NOT NULL) AND (archived_at IS NULL) AND (status <> 'done'::text));
CREATE INDEX tasks_module_link_lookup ON tasks.module_links USING btree (module, tenant_id, resource, resource_id);
CREATE UNIQUE INDEX tasks_module_link_unique_source ON tasks.module_links USING btree (owner_user_id, module, resource, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), resource_id);
CREATE UNIQUE INDEX tasks_one_module_link_per_task ON tasks.module_links USING btree (task_id);
CREATE INDEX tasks_notifications_unread ON tasks.notifications USING btree (recipient_user_id, created_at DESC) WHERE (read_at IS NULL);
CREATE INDEX parked_owner_inbox ON tasks.parked_ideas USING btree (owner_user_id, created_at DESC) WHERE (state = 'inbox'::text);
CREATE INDEX task_v2_project_owner_status ON tasks.projects USING btree (owner_user_id, status, sort_order) WHERE (archived_at IS NULL);
CREATE INDEX tasks_subtask_parent ON tasks.subtasks USING btree (task_id, sort_order);
CREATE INDEX task_collaborators_user ON tasks.task_collaborators USING btree (user_id, task_id);
CREATE UNIQUE INDEX task_invite_pending ON tasks.workspace_invitations USING btree (workspace_id, lower(email)) WHERE ((accepted_at IS NULL) AND (revoked_at IS NULL));
CREATE INDEX task_workspace_members_user ON tasks.workspace_members USING btree (user_id, workspace_id);

-- Tables are private; RLS remains enabled on every table.
DO $acl$ DECLARE r record; BEGIN FOR r IN SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='tasks' AND c.relkind='r' LOOP EXECUTE format('ALTER TABLE tasks.%I ENABLE ROW LEVEL SECURITY',r.relname); EXECUTE format('REVOKE ALL ON TABLE tasks.%I FROM PUBLIC,anon,authenticated',r.relname); EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE tasks.%I TO service_role',r.relname); END LOOP; END $acl$;
COMMIT;
