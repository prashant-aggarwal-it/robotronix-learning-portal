# My Tasks — SaaS UI/UX audit and visual consolidation

## Evidence and scope
Reviewed the 10 November 2026 local screenshots supplied by the user, including My Day at different scroll positions, Inbox, All Tasks, Kanban Board, Focus & Finish, Connected Work and Settings & Data. Weekly Planner was not included in those screenshot views; it receives shared styling only, and browser review is still required. This phase is UI-only, on feature branch \`feature/my-tasks-v2\`.

## Visual-quality issues in the original screenshots

| Area | Finding | Resolution |
| --- | --- | --- |
| My Day | Top 3, Today's diary and Today & Overdue rendered the same actionable tasks repeatedly | Progress section now renders **completed only**; active Top 3 tasks excluded from the next-up list |
| My Day | Large list extended beyond adjacent Area and Upcoming cards | Next-up list initially shows up to eight items; "Show remaining today" progressively reveals more |
| All Tasks | Narrow vertical list alongside duplicated Area summary created an empty right-side gap | Full-width two-column grid of scannable task rows; progressive Show More |
| Inbox | Empty narrow list and redundant adjacent summary wasted horizontal space | Full-width Inbox state, dedicated contextual heading |
| Kanban | Grouping repeated in sidebar and toolbar; too many scrollable/empty columns | Group only in toolbar; completed column hidden by default but available through Show Done, including the status selector |
| Focus | Large artificial minimum height and detached settings cards created a broad blank area | Remove min-height; focus controls, preferences and history stacked in primary column; parking and balance in the secondary column |
| Connected Work | Team form occupied the default Overview before pending assignments | Overview shows compact workspace summary; the full Team Spaces form appears only under its tab |
| Connected Work | Same navigation options repeated in sidebar and tab bar | Tab bar is canonical; duplicate sidebar group removed |
| All screens | Tiny secondary labels and uneven spacing, radii and cards | Shared style layer with 13–14px primary row typography, consistent cards, spacing and keyboard focus |
| Settings | Inconsistent controls | Shared styling aligns with the same system; original import/export behavior unchanged |

## Product principles
- One clear primary action per view. Preserve quick capture while keeping detailed edits in the shared task drawer.
- Do not render the same active task in multiple adjacent **My Day** lists.
- Progressive disclosure when a list is long, rather than an endlessly tall dashboard.
- Empty states take the available width; do not create a vacant adjacent column.
- Team setup is a subview, not a mandatory form at the top of every Connected Work visit.
- Visual hierarchy: readable text, clear status, limited secondary metadata, understated color, consistent border radii, subtle shadows, focus indicators.
- Preserve access control, task linkage, drag/drop fallbacks, planning, recurrence and user data.

## Changed files
- \`features/tasks/v2/TasksV2Dashboard.tsx\`
- \`features/tasks/v2/TasksV2Board.tsx\`
- \`features/tasks/v2/TasksV2Focus.tsx\`
- \`features/tasks/v2/TasksV2Connected.tsx\`
- \`features/tasks/TaskCollaboration.tsx\` (neutral UI copy only)
- \`app/tasks/ui-polish.css\` (new shared visual layer)
- \`app/tasks/layout.tsx\` (load the visual layer)
- \`lib/server/tasks/v2-ui-polish.test.mjs\` (new layout/UX regression contracts)
- \`lib/server/tasks/v2-phase2.test.mjs\` (replace old diary expectation)
- \`package.json\` (include UI regression contracts)

No production deployment, merge, schema migration or database data edits.

## Acceptance and UAT checklist
1. At ~1440–1600px, validate My Day Top 3 and completed progress, 4 metric cards, 8-item next-up list and a balanced right stack.
2. Confirm Top 3 tasks are not duplicated in Next up & overdue, while the original Tasks data is unchanged.
3. With 0, 3 and 30 tasks, check empty, short and long lists, including Show remaining today.
4. All Tasks must use available content width with two-column cards, Show More, search and completed filtering.
5. Inbox should occupy full content width and have clear empty guidance.
6. On the Kanban Board, verify moving tasks to Done via the status selector while Done lane is hidden, then toggle Show Done.
7. Drag and keyboard controls must still work; status changes persist and refresh correctly.
8. Focus: start a session, pause/resume, park/switch; confirm preferences and history align under the focus controls without an empty left column.
9. Connected Work: Overview shows compact workspace summary; Team Spaces tab still permits invitation, creation, comments, delegated status changes and attachments.
10. Verify Settings, Planner, Recurrence, Notifications and CRM/Learning task links remain functional.
11. Test responsive widths: desktop ~1600px, laptop ~1280px, tablet ~900px, mobile ~390px; confirm no overflow or overlapping buttons.
12. Browser DevTools: inspect and resolve the "1 Issue" indicator visible in screenshots. The supplied images do not reveal the underlying error.
13. Run \`npm run test:tasks-v2\`, \`npm run typecheck\`, \`npm run build\` and browser UAT against Development Supabase.

## What is NOT yet validated
Source code and CSS are updated, but a browser rendering of these **new** changes and a real TypeScript/Next.js build have **not** been performed through the GitHub-only connector. Product-pitch suitability is not proved by visual cleanup alone. A standalone SaaS rollout also needs account-specific branding, external-user onboarding, tenant/CRM access isolation, permissions verification and end-to-end test coverage. Demo-labelled records in current screenshots are Development sample data, not proof of production seed content.

## Release restriction
Everything stays in \`feature/my-tasks-v2\`. Do not merge, deploy or modify Production until the user explicitly approves.
