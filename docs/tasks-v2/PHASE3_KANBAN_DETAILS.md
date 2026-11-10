# Universal My Tasks 2.0 — Phase 3: Visual Board and Task Details

## Release boundary

- GitHub branch: `feature/my-tasks-v2`.
- Base branch: `feature/universal-my-tasks`.
- Development Supabase: `fflejkqcspivnhsmkdtn`.
- Production Supabase: `njyktzenybimykpqaegn` — **not modified**.
- Classic Tasks remains at `/tasks`; new My Day at `/tasks/v2`.
- **New Kanban board: `/tasks/v2/board`.**
- This is feature-branch and development-database work only. Nothing was merged into `main` or deployed.

## Completed functionality

### Visual Kanban
- Status grouping: **To Do**, **In Progress**, **Waiting**, **Done**.
- Alternative grouping: **Area**, **Project**, **Person**.
- Board cards show priority, area, due/planned dates, important flag, estimate, definition of Done and checklist progress.
- Native drag-and-drop for owner-controlled tasks.
- Per-card keyboard/mouse accessible column selector and up/down reordering buttons.
- Search, priority filter and completed-task visibility toggle.
- Quick capture from the board; a one-line title is sufficient.
- Project and Area grouping support drag/drop, including clearing incompatible project associations when changing Areas.
- Person grouping separates owned/assigned, delegated and other shared tasks; assignment edits remain in Classic Tasks.

### Full task drawer (shared by Dashboard and Board)
- Editable title, description, status, priority, area, project, planned date, due date, importance and estimated effort.
- **Definition of Done** and **Park & Resume** note fields.
- Waiting-for details and follow-up date for Waiting tasks.
- Live subtask checklist: create, complete/uncomplete, delete, plus progress bar.
- Read-only details for tasks not owned by the current account; Classic Tasks retains its collaboration tools.
- Server-side atomic detail save; no partial task metadata update if a validation or persistence error fails.

## Database migration order

Development Supabase has successfully applied:

1. `12_v2_board_and_details.sql` — transactional move/edit functions; deterministic baseline ranks for untouched tasks.
2. `13_v2_detail_save_correction.sql` — fixes legacy JSONB field projection for the already-applied Development migration.
3. `14_v2_board_snapshot.sql` — private paginated board query with checklist counts.
4. `15_v2_group_board_order_fix.sql` — reorders all task statuses together for Area and Project columns.
5. `16_v2_capture_order_fix.sql` — assigns stable board position to newly created tasks, even within one transaction.

**Fresh installations:** Use the corrected source files `11_v2_capture.sql` and `12_v2_board_and_details.sql` in their intended order. The later corrective migrations are for already-applied installations. Never rerun `10_v2_foundation.sql` on an existing database.

## API endpoints

- `GET /api/tasks/v2/board?limit=250&offset=0`
- `POST /api/tasks/v2/items/:id/move`: `{status,group_by,group_id,position}`
- `PATCH /api/tasks/v2/items/:id/detail`: comprehensive validated task update.
- Existing `GET/POST/DELETE /api/tasks/:id/subtasks` reused.

All endpoints call the existing verified `taskSession` guard, passing the verified `session.userId` to service-role-only RPC functions. Direct anon/authenticated access to new functions is revoked. Owners alone can reorder or edit full details; non-owner collaboration remains governed by Classic Tasks.

## Integration protection

- Standard transitions call legacy `task_update`, preserving completion timestamps, recurrence generation, CRM status sync and existing activity history.
- Moving to **Waiting** uses the V2 metadata procedure, including its linked-record safeguard.
- Linked CRM/Learning tasks are explicitly rejected from Waiting rather than being silently disconnected.
- Reopening completed tasks clears the completion timestamp via the legacy API.
- Existing task records, CRM integration records and personal categories remain intact.

## Verification completed (Development only)

Rollback-only SQL tests passed:
- Transitions To Do → In Progress → Waiting → Done → To Do.
- Stable initial capture order and mixed-status Area/Project column ordering.
- Moving between Areas clears a mismatched Project, and moving into a Project selects its Area.
- Complete detail save with title, priority, status, definition of Done, estimated effort and resume notes.
- Read-only checklist snapshot with total and completed subtask counts.
- Cross-user board moves and detail changes rejected.
- Linked Learning task refused entry to Waiting.
- Completing recurring tasks creates the next occurrence, preserving the original recurrence logic.
- Test transactions were rolled back; no QA tasks were left behind.

## Required local checks (not executed by the remote connector environment)

```bash
git fetch origin
git switch feature/my-tasks-v2
git pull --ff-only origin feature/my-tasks-v2
npm ci
npm run test:tasks-v2
npm run typecheck
npm run build
npm run dev
```

Local `.env.local` must point exclusively to Development Supabase. Open:
- `http://localhost:3000/tasks/v2` — My Day
- `http://localhost:3000/tasks/v2/board` — Visual Board

## Browser UAT checklist

- Drag a card to a different status; refresh and confirm persistence.
- Reorder within a column with drag-and-drop and arrow buttons.
- Switch between Status, Area, Project and Person; verify no duplicate cards.
- Drag a task between Areas and Projects and verify associations.
- Move a task to Waiting, complete it, then reopen it.
- Open details and save the title, description, priority, due date, definition of Done and resume note together.
- Add, tick, untick and delete subtasks; confirm board progress counters.
- Verify invalid/unavailable project selection fails safely.
- Check linked CRM task transitions and recurring next-occurrence behaviour.
- Check a shared task is not granted owner-only actions.
- Verify laptop, narrow browser and mobile layouts, including horizontal swipe.
- Regression-test Classic Tasks, Connect CRM and Learning Portal.

**Important:** The GitHub connector does not execute a Next.js build. A direct local clone attempt failed due to network DNS restrictions. Browser/UI testing and `npm run typecheck` / `npm run build` remain required before Phase 3 is approved for rollout.

## Next

Phase 4 adds Finish Mode, distraction parking, focus timeboxes, intentional stopping points and Focus Balance. Do not begin a Production rollout until local build and UAT pass and the user explicitly approves.
