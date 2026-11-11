# Universal My Tasks 2.0 — Phase 5: Planning, Scheduling & Consistency

## Scope and boundaries

- Development branch: `feature/my-tasks-v2`, based on `feature/universal-my-tasks`.
- Development Supabase project: `fflejkqcspivnhsmkdtn`.
- Production Supabase: `njyktzenybimykpqaegn` — **not modified**.
- No merge into `main`, no Production database migrations, no deployment.
- New opt-in page: `/tasks/v2/planner`; old `/tasks` continues to work.
- All V2 navigation entries point to the planner.

## Implemented features

1. **Seven-day visual planner:** Monday–Sunday columns; drag owned cards onto a day to set a planned date. Previous, next and current week controls.
2. **Today, Upcoming and Someday:** dedicated views; Someday is a deliberate parking location, separate from Inbox and today's focus. Hard deadlines are *still* surfaced in Upcoming/Overdue when a task is otherwise parked.
3. **Quick capture:** new task with a one-line title, optional Today/Tomorrow planned date. Task creation persists using the existing V2 atomic capture.
4. **Multi-task planning:** select owned tasks and atomically plan them together, clear planned dates, or park them as Someday. Maximum 50 per transaction; unauthorized or invalid IDs reject the whole update.
5. **Workload capacity:** sum task estimates per day against configurable daily focus capacity saved using Phase 4 Focus settings. Warn when planning exceeds capacity, without blocking tasks.
6. **Overdue recovery:** distinguish missed planned dates from hard due dates, then reschedule or park the *planned work*. A hard deadline, reminder or recurrence isn't automatically altered.
7. **Priority Matrix (optional):** 2×2 importance/urgency view, with drag-and-drop and select controls. `important` and `urgent` are independent booleans; a due-soon date does not automatically imply importance.
8. **Recurring review template:** create a weekly recurring review task using existing task recurrence. The control prevents duplicate active templates. Review covers wins, missed work, rescheduling and protected Areas.
9. **Recurrence and reminder controls:** the shared V2 Task Detail drawer now allows daily/weekly/monthly recurrence and date-time reminders via the existing backend and reminder scheduler.
10. **Repeating-task metadata:** a narrowly scoped insert trigger copies V2 Area, Project, importance, urgency, effort estimate and Definition of Done onto the *new* recurring occurrence; it does not copy a previous resume note.
11. **Reschedule history:** `reschedule_count` increments when a task's existing planned date changes. Repeatedly deferred cards show a subtle cue.
12. **Accessibility:** alternate controls for dragging through bulk selection and date chooser; separate matrix select control; mobile horizontal scrolling of the week.

## New code and APIs

- `features/tasks/v2/TasksV2Planner.tsx`
- `app/tasks/v2/planner/page.tsx`
- `app/tasks/v2/planner/planner.css`
- `POST /api/tasks/v2/planner` — owner-scoped atomic changes to scheduled dates or Someday.
- `PATCH /api/tasks/v2/items/:id/matrix` — owner-scoped importance+urgency changes.
- `lib/server/tasks/v2-phase5.test.mjs` — static contract checks.

Existing V2 screens and the shared task drawer were updated to expose the planner and recurrence/reminder editing.

## Development migrations

The following are applied in Development:

- `20_v2_week_planner.sql` — Someday, reschedule count, transactional planner RPC.
- `21_v2_priority_matrix.sql` — urgent flag and matrix update RPC.
- `22_v2_recurrence_reminders.sql` — allow recurrence/reminders through shared detail-save.
- `23_v2_recurrence_partition_fix.sql` — post-apply correction for separating legacy update fields and V2 metadata.
- `24_v2_recurrence_context.sql` — preserve V2 fields on auto-generated recurring occurrences.
- `25_v2_someday_focus_reset.sql` — post-apply correction: moving to Someday clears Top 3 focus date and rank.

For **fresh Development installs**, apply in sequence. Corrected source migrations 20/22 already contain their respective fixes; 23/25 remain safe as idempotent replacement operations when applying the complete history. Never apply these scripts to Production without explicit approval.

### Security

Both new RPC functions are executable by the service role only and read/update tasks using `owner_user_id` supplied by the already-authenticated API. The planner rejects any mixed-valid/unauthorized batch rather than writing some updates. Existing CRM-linked task status handling is not changed by scheduling.

## Database verification performed

Rollback-only SQL transactions passed:
- Batch rescheduling updates planned dates and counts a previously planned date change.
- Someday and unscheduled transitions can be reversed.
- Moving to Someday clears an active Top 3 selection.
- A hard due date and reminder remain unchanged when planned work is rescheduled.
- Recurrence remains enabled after moving a planned date.
- Importance and urgency can be changed independently.
- Cross-account Matrix edits and Planner moves fail safely.
- A multi-ID batch containing an inaccessible ID fails atomically.
- Completing a weekly task creates its next occurrence, preserving Area, Project, importance, urgency, estimate, Definition of Done and reminder, but resetting the old resume note.
- No QA data remains after transaction rollback.

## Local testing still required

The GitHub/Supabase connector environment cannot clone GitHub through the container due to DNS/network restrictions. Consequently **TypeScript compilation, Next.js build, automated Node test execution, and browser UAT are not yet verified**.

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

Ensure `.env.local` targets **Development Supabase** before executing the app. Then open `http://localhost:3000/tasks/v2/planner`.

### Browser UAT checklist

1. Drag a task to tomorrow and refresh; the planned date persists.
2. Select three tasks and batch plan for Friday; check the daily workload meter.
3. Park a task in Someday, verify it leaves Inbox and Top 3; move it back later.
4. Confirm moving planned dates does not move hard due dates or reminders.
5. Move task importance/urgency between all four matrix quadrants.
6. Set daily, weekly and monthly recurrence from task details; complete a task and inspect the next occurrence.
7. Create a recurring weekly review; avoid duplicate active review tasks.
8. Change focus capacity and refresh; setting persists.
9. Review overdue work and distinguish planned dates from deadlines.
10. Check narrow desktop/mobile, touch fallback selection, shared-task restrictions and keyboard navigation.
11. Regression-test Classic Tasks, Portal, CRM, reminder notifications, and recurring assignment workflows.

## Next phase

Phase 6: collaboration, connected work and cross-module regression. Do not promote V2 to default or merge/deploy without local build and browser UAT signoff.
