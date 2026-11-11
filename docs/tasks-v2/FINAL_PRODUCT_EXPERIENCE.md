# My Tasks — final product-experience pass (10 Nov 2026)

Branch: \`feature/my-tasks-v2\` only. No changes to Production Supabase, main, or deployment.

## Product design rationale

A useful task product is not measured by the number of dashboard tiles. Each visible widget must answer a decision question and, where relevant, lead to an action.

Reviewed user screenshots of My Day, Inbox, All Tasks, Kanban grouped by Status/Area/Project/Person, Focus, Planner and Connected Work. Reviewed official product behavior:
- [Todoist Today](https://www.todoist.com/help/todoist/get-started/plan-your-day-with-the-today-view-UVUXaiSs): daily priority and planning controls.
- [Asana My Tasks](https://asana.com/features/project-management/my-tasks): unified task ownership and flexible list, board and calendar views.
- [ClickUp Home](https://clickup.com/features/home): actionable reminders, daily work and agenda.
- [Linear board layout](https://linear.app/docs/board-layout): grouped issues and optional empty lanes.

We use these interaction patterns as research, **not** copied screenshots, CSS, branding or proprietary assets.

## Final information architecture

Consistent, shared navigation on all Tasks pages (one component, \`TasksPrimaryNav\`):

1. DO — My Day → Inbox → All Tasks
2. PLAN & TRACK — Weekly Planner → Visual Board → Focus & Finish
3. COLLABORATE — Connected Work
4. PREFERENCES — Settings & Data

My Day / Inbox / All Tasks preserve their shareable URLs with \`?view=\` parameters.

## Dashboard (decide, don't just look)

- **Quick capture** at the top is retained for one-line task entry.
- **Four task metrics** are actual counts; actionable totals lead to the relevant screen.
- **Top 3** remains the explicit user's chosen outcomes; those tasks are excluded from Next up to avoid duplicates.
- **Daily momentum ring** uses tasks completed today and still-open tasks planned for today. It suggests an actual next task, opening its details. The ring never invents activity or a score.
- **Known planned effort** sums explicit task estimates only. When estimates are missing the screen says so rather than pretending to know the user's workload. If available, the comparison uses their saved focus capacity.
- **7-day workload** is a real visual overview of scheduled/open task counts, keyed by local dates, with a link to the Planner. Real deadlines on Someday tasks remain visible.
- **Next up & overdue** presents up to eight non-Top-3 actions initially; expandable in place.
- **Coming up next** remains a future-action preview, not a second copy of Top 3.
- **Areas at a glance** was removed from the My Day right column because the sidebar already shows area counts. A meaningful 7-day chart replaces it.
- **All Tasks** adds practical filters: All Open, Overdue, High Priority and Waiting, with live counts. Search, Show Completed and Show More remain.
- **Inbox** retains its full-width empty and non-empty states.

## Board and other screens

- Board has a single group-by control and a separate **Empty groups** toggle. It hides blank Area/Project/Person lanes when populated lanes exist, avoiding unnecessary scroll, while preserving an empty fallback if no tasks match. Status selector still provides an accessible move option; Show Done reveals the completed lane.
- Weekly Planner already provides current week, Today, Upcoming, Someday and Priority Matrix; kept intact, with shared visual styling. The seven-day chart links to Planner rather than building a second planner.
- Focus retains timebox, Pomodoro, park/resume, protected commitments, preferences and history. No extra focus form added to dashboard.
- Connected Work shows assigned/delegated work if present. If both counts are zero, it shows one useful invitation to Team Spaces rather than two empty cards. Module links and role checks are unchanged.
- Settings keeps import/export and account diagnostics.

## Files

- New: \`features/tasks/v2/TasksPrimaryNav.tsx\`, \`app/tasks/product-experience.css\`, \`lib/server/tasks/v2-final-experience.test.mjs\`.
- Changed: existing V2 Dashboard, Board, Connected Work, Focus, Planner and Settings for shared navigation; task layout CSS import; appropriate phase contract tests; package.json test script.
- No new database migrations, API changes, deletions of task records or seed modifications.

## Acceptance criteria and checks

1. Navigation order is identical across all six screens; link active states are correct. Refreshing \`/tasks?view=inbox\` and \`/tasks?view=all\` preserves the selected view.
2. Capture a task, assign an Area, set a date and priority. It should appear in Inbox, Today, Planner or Board as appropriate without duplicate records.
3. Set and remove Top 3. Confirm the same active task does not reappear in Next up & overdue.
4. Complete a task. Confirm Daily Momentum changes, list/drawer status matches, and any recurring copy is generated through the existing API pipeline.
5. Test unknown estimates, partial estimates and complete estimates. The effort widget should never imply minutes not recorded.
6. Use All Tasks filters with search and area filters, including zero-match state; Show More should not reset other filters.
7. Confirm Overdue and dated Someday tasks are visible in the relevant views and date logic respects user's local day.
8. Inspect 7-day chart with zero tasks, sparse tasks and heavy scheduled days. Counts must match tasks and chart must be readable in mobile view.
9. Board grouped by Status, Area, Project and Person: hide/show empty groups; move a task to an empty status using controls; check keyboard fallback and drag behavior.
10. Connected Work: no assignments, some assignments, permissions, invite/manage Team Spaces, CRM and Learning source links.
11. Planner, Focus, import/export and notifications pass functional regression.
12. Verify spacing at desktop 1600/1366px, tablet 900px and mobile 390px, including sidebar and modal/drawer overflow.
13. Click the red Next.js \`1 Issue\` indicator visible in the local screenshots and inspect its actual stack trace.
14. Run \`npm run test:tasks-v2\`, \`npm run typecheck\`, \`npm run build\`. An external browser UAT is necessary before considering release readiness.

## Known limits

**GitHub source-level inspection is not a successful Next.js build or browser UAT.** No build, runtime tests, visual baseline screenshot after this final pass, or end-to-end interactions were executed by this remote connector session. All changes are committed on the feature branch and require local validation. A future multi-tenant external SaaS offering also requires security/UAT, onboarding, branding decisions and a release checklist; none is implied complete merely by UX improvements.
