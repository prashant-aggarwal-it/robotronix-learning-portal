# My Tasks 2.0 — Phase 6: Collaboration & Connected Work

## Release boundary and design decision

- GitHub branch: `feature/my-tasks-v2` (no merge into `main`).
- Development Supabase: `fflejkqcspivnhsmkdtn`.
- Production Supabase: `njyktzenybimykpqaegn` — **untouched**.
- No deployment, no Production migration, no `main` changes.
- Opt-in V2 hub: **`/tasks/v2/connected`**. Classic Tasks remains at `/tasks`.

**Phase 6 deliberately reuses the existing collaboration and source-link services.** Creating parallel workspace, invitation, attachment or CRM-link tables would increase security and consistency risk. No new database schema was required or applied in this phase.

## What was implemented

### Connected Work hub
- Four overview metrics: Team Spaces, Assigned to me, Delegated by me, and Connected source links.
- Sections: Overview, Team Spaces, Assigned to me, Delegated, Connected modules.
- Modern, responsive cards; task search; status display; open the shared V2 task drawer.
- Team Spaces UI reuses `TeamSpaces`: create workspace, invite by verified email, accept invitation, manage members, create shared tasks, and delegate. No duplicate workflow or custom permissions.
- Assigned non-owner tasks can be moved between existing legacy statuses (To Do, In Progress, Done) via `PATCH /api/tasks/:id`; the server checks assignee/task access. Task detail metadata remains owner-only.
- Source-linked items are retrieved from the existing `GET /api/tasks/module-links`, which enforces Connect tenant membership and Learning Portal role/access. Private personal and shared tasks remain distinct.

### Shared Task Details: People & Connections
- Every V2 task drawer (Dashboard, Board, Planner, Connected Work) now has a **People & Connections** tab.
- It reuses `TaskCollaborationDetail`, which provides permission-checked sharing, assignment, collaborators, comments, activity, attachments and signed attachment downloads.
- For a non-owner assignee, only a narrowly scoped status selector is available; owner-only task details are read-only.
- Source-linked tasks show the original CRM/Learning resource type and task status and a link to the originating module.
- Share and collaborator editing controls are hidden for source-linked tasks; the existing `tasks.prevent_module_link_sharing` database trigger still enforces this on the server.
- Learning Portal links are role-aware: Admin → `/admin/schedule`, Trainer → `/trainer/schedule`, other users → `/`. Connect CRM → `/connect`. No unverified resource-specific deep links are invented.

### Source modules → V2
- The existing `ModuleTaskLinkButton` used in Connect CRM and Learning Portal continues calling `POST /api/tasks/module-links`.
- After linking a record, it now offers **Open in V2** using the validated server-returned `task_id`.
- `ModuleTasksWidget` links existing source-linked tasks to `/tasks/v2/connected?task=<task_id>`.
- Classic Tasks remains one click away. No source record ownership, visibility or workflow state is changed merely by linking.
- The V2 Connected hub opens a deep-linked task drawer only once; closing it does not cause it to reopen on later refreshes.

### Usability and resilience
- Navigation for Connected Work added to every V2 screen.
- Board cards now show **Shared / Assigned to you** and **Connect CRM / Learning Portal** badges.
- Team Spaces continues loading even when invitations cannot be retrieved for a user without eligible verified email access; invitation authorization remains unchanged.
- Responsive layouts for compact screens and task drawer. Existing Classic collaboration CSS is loaded from the V2 layout, and shared V2 tab styles are available on all V2 routes.

## GitHub changes

- `features/tasks/v2/TasksV2Connected.tsx`
- `features/tasks/v2/TaskV2CollaborationPanel.tsx`
- `features/tasks/v2/TaskV2DetailDrawer.tsx` — new People tab
- `features/tasks/v2/TasksV2Board.tsx` — shared and source badges
- `features/tasks/v2/model.ts` — workspace/module-link types
- `features/tasks/TaskCollaboration.tsx` — optional sharing-disabled guard, invitation loading fallback
- `features/tasks/ModuleTaskWidgets.tsx` — source modules link directly to V2 task
- `app/tasks/v2/layout.tsx` — inherited Classic collaboration styles
- `app/tasks/v2/connected/page.tsx`
- `app/tasks/v2/connected/connected.css`
- `app/tasks/v2/v2.css`
- `app/tasks/v2/board/board.css`
- `lib/server/tasks/v2-phase6.test.mjs`
- `package.json` — Phase 6 added to `npm run test:tasks-v2`

No existing authentication or module-link API was replaced.

## Development database verification — rollback only

Verified with transactions that end in `ROLLBACK`; no QA task or workspace records were retained.

- Workspace creation and owner membership.
- Verified-email invitation issuance and acceptance.
- Membership recorded for another authenticated Development test account.
- Shared workspace task creation, delegation and assignee visibility.
- Assigned user could update task status via existing `task_update`.
- Assigned user could not change owner-only V2 title/details.
- Assigned user could not change task sharing permissions.
- Shared task appears in `task_v2_board_list` for the assigned member.
- Comment posted by a collaborator was readable by the task owner.
- A personal source-linked task could not be shared into a team workspace.
- The current Development baseline remained unchanged after rollback.

Static verification of new Phase 6 source wiring also passed 32/32 targeted checks. The new `v2-phase6.test.mjs` file additionally checks the source-module deep link. This static verification **does not replace** compiling and running the automated test command.

## Local verification still required

The GitHub/Supabase connector environment can inspect and commit code and execute SQL, but the repository is not available as a local clone for a Next.js build. Consequently the following have **not** been executed: the Node test runner, TypeScript compilation, Next.js build, and browser UAT.

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

Set `.env.local` to **Development Supabase** only.

Open:
- `http://localhost:3000/tasks/v2/connected`
- `http://localhost:3000/tasks/v2/board`
- `http://localhost:3000/tasks/v2`

## Browser UAT

1. Create a Development Team Space, invite a verified colleague, accept the invitation, delegate a task, and update its status while signed in as the assignee.
2. Verify the assignee cannot edit owner-only task metadata or reassign ownership.
3. Post a comment, attach a permitted test file, download it through the signed link, then delete it using the existing authorization rules.
4. Open a V2 task drawer from My Day, Board and Planner; verify the People tab, comments and activities load.
5. Link a CRM follow-up using the existing **Track in My Tasks** button and open it through **Open in V2**. Verify source status sync with real CRM data.
6. Link a Learning schedule event using its existing My Tasks button and open it in V2 with Admin/Trainer role.
7. Confirm source-linked tasks cannot be shared or moved into Waiting, and the original CRM/Learning record is not modified by merely viewing it.
8. Verify Team Spaces and other views work when no invitations, no assignments or no linked records exist.
9. Test mobile and desktop spacing, long task titles, permission failures and page reload.
10. Regression-test Classic Tasks, CRM follow-ups, Learning schedule, task notifications, recurring tasks and module sync.

**Release gate:** Do not merge into main or deploy until local automated tests, build, and browser UAT pass and explicit user approval is given.

## Next

Phase 7 is the comprehensive stabilization, accessibility and end-to-end QA phase, not another major feature expansion. It should reconcile all V2 changes, run the full test suite, fix compilation/runtime issues and prepare a safe release checklist.
