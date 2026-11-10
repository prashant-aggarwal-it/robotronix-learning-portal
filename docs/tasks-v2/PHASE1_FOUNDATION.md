# My Tasks 2.0 — Phase 1 foundation (Development only)

## Scope and source of truth

- Base: `feature/universal-my-tasks` at `7d1a4896f73022f68e73606a468f6522db4c0a6a`.
- Implementation branch: `feature/my-tasks-v2`.
- Development database: `fflejkqcspivnhsmkdtn`.
- Production database: `njyktzenybimykpqaegn` — **do not migrate**, deploy, or alter.
- Migration: `database/tasks/10_v2_foundation.sql` (applied in Development as `tasks_v2_foundation`).
- Existing Tasks, CRM links, Learning Portal, role checks, notifications, imports and workspaces are preserved.

## Phase 1 implementation

New private tables:
- `tasks.areas`: personal/professional areas with owner, colour, icon and order.
- `tasks.projects`: projects optionally associated with an area, owner scoped.

Additive `tasks.items` fields:
- `area_id`, `project_id`: optional; existing category_id remains unchanged.
- `board_rank`: stable board ordering key for Phase 3.
- `important`: importance separate from legacy high/medium/low priority.
- `estimated_minutes`: optional planned effort, 1–1440.
- `done_definition`: what counts as finished.
- `resume_note`: where to resume.
- `waiting_for`, `followup_date`: waiting context.
- `waiting` added to the status constraint without changing existing statuses.

**No data backfill or destructive migration**: old task rows have null area/project/estimate and keep existing categories. Legacy task routes and `task_create`, `task_update` and `task_list` are unchanged. The new Waiting status is opt-in via V2 only. The old UI does not expose the Waiting status yet; Phase 3 will adapt the board and filters.

## API contracts (server-only Supabase RPCs)

All API calls require a valid signed-in session using the existing `taskSession` server guard. The caller/user ID comes from verified authentication, never the JSON request.

- `GET /api/tasks/v2/areas` — list active areas for the caller.
- `POST /api/tasks/v2/areas` — create/update/archive an area (supply `id` for edits).
- `GET /api/tasks/v2/projects` — list active projects for the caller.
- `POST /api/tasks/v2/projects` — create/update/archive a project (supply `id` for edits).
- `PATCH /api/tasks/v2/items/:id` — update V2 metadata, and the special Waiting transition.

Server RPC functions: `task_v2_areas_list`, `task_v2_area_save`, `task_v2_projects_list`, `task_v2_project_save`, `task_v2_patch`.

These private-schema tables have RLS on; direct anon/authenticated access is revoked. RPC execution is granted only to `service_role`. The server validates payloads and passes the verified account ID. Cross-owner updates return no result. Project and area associations cannot reference another owner's records.

**Compatibility caution:** To leave recurring-task and CRM status transitions unchanged, normal `todo`, `in_progress` and `done` status updates remain on the existing `PATCH /api/tasks/:id` endpoint. The V2 patch accepts only a transition **to** `waiting` and refuses it for CRM/Learning-linked tasks. The old endpoint handles switching **out of** Waiting. Phase 3 will unify this behind the board interaction.

## Phase 1 test evidence

Development database migration applied successfully. Rollback-only SQL QA verified:
- creation of an owned area and project;
- no cross-account area/project/task edit;
- new task metadata and Waiting transition;
- legacy transitions Waiting → To Do → Done;
- no data permanently inserted by the test transaction.

Baseline after migration: 45 pre-existing tasks, 5 categories, 0 module links in the Development project; no existing task rows were deleted or overwritten. New tables start empty deliberately.

Run code tests after pulling branch:
```bash
npm ci
npm run test:tasks-v2
npm run typecheck
npm run build
```
Those local commands are **required before Phase 2 sign-off** and were not executed by the GitHub/Supabase connector operations. They do not deploy to Netlify.

## Stage boundaries

Phase 2 will replace the My Day UI, introduce fast capture, and opt-in to areas and projects.
Phase 3 will implement draggable board with a unified status flow.
Phase 4 will implement Focus/Finish sessions and Park & Resume flows.
Do not merge to main or deploy to Production without explicit approval.
