# Universal My Tasks 2.0 — Phase 2: Visual My Day and Quick Capture

## Release boundary

- Feature branch: `feature/my-tasks-v2` (branched from `feature/universal-my-tasks`).
- The existing classic Tasks app at `/tasks` is **unchanged** except for a preview link.
- The new UI lives at **`/tasks/v2`**. It is opt-in until UAT approval.
- Development Supabase: `fflejkqcspivnhsmkdtn`.
- Production Supabase: `njyktzenybimykpqaegn` — not modified.
- No deployment, merge into `main`, or production migration authorised.

## Implemented

1. **My Day**: visual metrics for open tasks, planned today, overdue and done this week.
2. **Quick Capture**: capture a task by entering only a title; area, project, priority and scheduling are optional.
3. **Atomic capture**: the single `task_v2_capture` database RPC creates a task and applies V2 area/project metadata within the same transaction. Invalid area/project rejects the entire operation.
4. **Top 3**: star/unstar up to three priorities using existing daily focus fields.
5. **Daily diary**: check off or reopen tasks without leaving the dashboard; completed tasks remain visible.
6. **Areas**: browse area progress, filter tasks by area, create custom areas.
7. **Projects**: create projects, assign tasks to existing projects, associate them with an area.
8. **My Inbox / All Tasks**: search, filtered lists and completed task visibility.
9. **Quick task editing**: choose area, project, planned date, priority, importance and estimated minutes from an inline detail panel. Existing Classic Tasks retains full subtasks/comments.
10. **Responsive layout**: dedicated V2 styling, mobile sidebar and keyboard shortcut `Ctrl/Cmd + K` to focus quick capture.
11. **Permissions**: server sessions determine the actor; metadata updates are owner-only. Shared tasks have read-only editing in the V2 drawer; the Classic Tasks link remains available.
12. **Compatibility**: existing task, category, CRM/Learning link, notification, collaboration and recurrence infrastructure remains in place.

## GitHub code paths

- `features/tasks/v2/TasksV2Dashboard.tsx`
- `app/tasks/v2/page.tsx`
- `app/tasks/v2/v2.css`
- `app/api/tasks/v2/capture/route.ts`
- `database/tasks/11_v2_capture.sql`
- `database/tasks/DEV_ONLY_v2_demo_areas.sql` (seed script — **never apply to Production**)
- `lib/server/tasks/v2-phase2.test.mjs`
- Classic sidebar entry in `features/tasks/TasksWorkspace.tsx`

## Development data

The existing 45 synthetic Tasks records were preserved. They are now mapped to 5 V2 Areas. 3 clearly labeled demo Projects were created and 10 demo tasks linked to them. Unrelated customer, production or untagged task records were not modified.

## Database verification

- The `tasks_v2_atomic_capture` migration was applied only in Development.
- Rollback-only SQL QA checked that an atomic task with Area, Project, priority, estimate and date is created correctly.
- An invalid Area causes the entire capture to roll back; no partial task remains.
- Cross-account task editing was denied.
- `task_v2_capture` is executable by `service_role` and **not** directly by `anon` or `authenticated`.
- Baseline after seeding: 45 tasks, 5 Areas, 3 Projects, 45 Area associations, 10 Project associations, 0 leftover QA tasks.

## Run locally

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

Open **http://localhost:3000/tasks/v2**. Your `.env.local` must target **Development Supabase**, not Production.

## Acceptance checks still required in a running browser

- Sign in and open V2 with a real Development account.
- Create task using title only, then add one with Area + Project + priority and Today.
- Check/uncheck a task, set Top 3, switch between Today / Inbox / All Tasks.
- Create an Area and Project; assign an existing task to both.
- Verify non-owner shared task editing is read-only.
- Verify narrow mobile viewport, keyboard quick capture and refresh persistence.
- Regression-check Classic Tasks, Connect CRM and Learning Portal navigation.

**Build and browser-level testing have not been run inside this connector session**. Run the commands above and UAT before promoting this as the default Tasks experience.

## Next phase

Phase 3: interactive drag-and-drop Kanban Board; card reordering/grouping; full task-detail drawer and unified status transitions including Waiting.
