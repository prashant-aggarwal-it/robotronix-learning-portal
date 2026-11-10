# Universal My Tasks 2.0 — Phase 4: Focus, Finish & Balance

## Deployment boundary

- Branch: `feature/my-tasks-v2`, preserving `feature/universal-my-tasks` and `main`.
- Development Supabase: `fflejkqcspivnhsmkdtn`; Production: `njyktzenybimykpqaegn` (**untouched**).
- New opt-in page: **`/tasks/v2/focus`**, linked from My Day, Visual Board and owned task details.
- No Production deployment or main-branch merge is authorised.

## User experience implemented

**Start one thing:** Choose an owned, open task. Options: Timebox (45m default), Pomodoro (25m), Stopwatch (counts up), and 5-minute starter. Duration can be adjusted within 5–240 minutes. A single account can have only one running or paused focus session.

**Timeboxes that persist:** The server stores when a focus session started, elapsed seconds when paused, the last resume time, and the planned minutes. The browser displays a one-second countdown/count-up based on these timestamps. Closing/reopening the page does not delete the active session.

**Stop & Switch:** When the timebox expires, a visible decision point appears (if enabled). The user—not software—chooses to extend by 15 minutes, pause, end, complete the task or park it with a required stopping note. There are no automatic task transitions, browser blocking or invasive device monitoring. An optional Pomodoro 5-minute break pauses the focus clock, using a local break countdown.

**Park & Resume:** An unfinished task can be parked with a note describing progress and the next action. The note is saved to `tasks.items.resume_note`, available later in the task drawer.

**Distraction Parking Lot:** Capture an idea in one line, linked to a current focus task if applicable, without changing the current work. Dismiss ideas or convert one atomically into a normal Inbox task.

**Focus Balance:** Display recent recorded focus time by Area. Set a suggested maximum of active projects (default two) and daily planned focus capacity (default three hours). These are soft guardrails, not restrictions.

**Protected Areas:** Set an optional rolling-seven-day minimum number of focus sessions (1–14) for chosen Areas, e.g. Sales & Outreach. Display completed sessions against targets with progress bars. Suggest an eligible task from an under-served protected Area at the Stop & Switch decision. Missed days do not reset streaks or penalise users.

**My Day entry point:** Compact Focus Balance strip shows whether a session is underway or whether protected Areas need attention, with a link into Focus & Finish. Owned board cards and the shared task drawer can launch Focus for a specific task.

## Database migrations (Development only)

Apply in order AFTER Phase 3:

- `17_v2_focus_balance.sql`: private `tasks.focus_sessions`, `tasks.parked_ideas`, `tasks.focus_settings`, owner-scoped RPCs; composite task-owner key for safe FK isolation.
- `18_v2_focus_commitments.sql`: private `tasks.focus_commitments`, one saved target per owned Area, completion counts on a rolling 7-day interval.
- `19_v2_parked_idea_fk_fix.sql`: corrections for the already-applied Development database: delete a referenced task without nulling the idea's owner. The corrected `17` source includes this for fresh installations.

All new private tables have RLS enabled. Direct `anon` and `authenticated` access is revoked, with RPC execution granted only to `service_role`. Every web API uses `taskSession` to verify the user and supplies `session.userId`, never an unverified actor ID.

## APIs

- `GET /api/tasks/v2/focus`: active session, recent completed history, ideas, settings and protected Area progress.
- `POST /api/tasks/v2/focus`: `action = start | pause | resume | extend | finish`.
- `POST /api/tasks/v2/ideas`: `action = capture | convert | dismiss`.
- `PUT /api/tasks/v2/focus/settings`: preferred active projects, capacity and switch prompt setting.
- `PUT /api/tasks/v2/focus/commitments`: Area weekly session target (0 clears).

## Verified database behaviour (rollback-only)

- Start, pause, resume, extend and finish a timed focus session.
- A second active session is rejected for the same owner.
- Elapsed time accumulates across pauses; a completion action updates the original task using its legacy `task_update` procedure.
- Parking saves the stopping note and closes the session.
- Idea capture, one-click conversion to a task, and dismiss actions.
- Invalid cross-account idea and weekly commitment operations denied.
- Weekly completed-session count and commitment add/remove.
- Deletion of a task linked to a parked idea preserves the idea's owner and safely clears its source reference.
- All test changes rolled back; no QA records retained.

## Files

- `features/tasks/v2/TasksV2Focus.tsx`
- `app/tasks/v2/focus/page.tsx`, `app/tasks/v2/focus/focus.css`
- `app/api/tasks/v2/focus/route.ts`
- `app/api/tasks/v2/focus/settings/route.ts`
- `app/api/tasks/v2/focus/commitments/route.ts`
- `app/api/tasks/v2/ideas/route.ts`
- `database/tasks/17_v2_focus_balance.sql`
- `database/tasks/18_v2_focus_commitments.sql`
- `database/tasks/19_v2_parked_idea_fk_fix.sql`
- `lib/server/tasks/v2-phase4.test.mjs`

## Required local checks (not yet executed by the connector environment)

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

Visit `http://localhost:3000/tasks/v2/focus` (Development Supabase configuration only).

### Browser UAT

1. Start a 5-minute session, navigate away and back, and verify elapsed time persists.
2. Pause/resume, extend, then park with a resume note; reopen task and verify note.
3. Start a Pomodoro, reach its limit, optionally take a five-minute paused break, and choose completion.
4. Record an idea while focused and convert it to a task. Check the Inbox.
5. Set a Sales & Outreach weekly commitment and complete a session from that Area.
6. Confirm suggested next protected work appears at a Stop & Switch decision.
7. Confirm a second active session is rejected and shared tasks cannot be focused as owner.
8. Check mobile layout and all screen links.
9. Regression-test Classic Tasks, Connect CRM, Learning Portal, recurrence and task notifications.

The local Next.js typecheck/build, browser rendering and end-to-end UAT **have not been run** in this connector session. A remote GitHub clone is unavailable in this execution environment. Do not promote the feature until those checks pass.

## Next phase

Phase 5: weekly visual planner, scheduled work, recurring review, workload capacity, overdue recovery and optional Eisenhower Matrix. Phase 4 features remain opt-in.
