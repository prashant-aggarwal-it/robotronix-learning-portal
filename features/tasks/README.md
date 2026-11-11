# My Tasks — unified application

**User-facing application:** `/tasks` is the current My Day dashboard. There is no separate Classic Tasks interface, no preview link and no V2 choice.

## Current routes

| Route | Screen |
| --- | --- |
| `/tasks` | My Day, Inbox, All Tasks, quick capture and Top 3 |
| `/tasks/board` | Visual drag-and-drop Kanban |
| `/tasks/focus` | Focus & Finish, Pomodoro, distraction parking, Focus Balance |
| `/tasks/planner` | Weekly Planner, Someday, overdue recovery, priority matrix |
| `/tasks/connected` | Team Spaces, assignments, CRM/Learning linked tasks |
| `/tasks/settings` | CSV import/export and account snapshot |
| `/tasks/welcome` | Task-only user onboarding |

Versioned `/tasks/v2` URL paths redirect to their corresponding current routes. Older bookmarks under `/tasks/[view]` also redirect to current views; `/tasks/all?task=<id>` opens the connected task drawer. Redirects contain no obsolete UI code.

## Files and integration

Current components live under `features/tasks/v2` for internal source compatibility, **not** because two applications remain. The old `TasksWorkspace.tsx`, `TaskDataTools.tsx`, `TaskInboxBell.tsx` and `tasks.css` were deleted. Their useful functionality was rebuilt or retained through current APIs:

- `TasksV2Dashboard`, `TasksV2Board`, `TasksV2Focus`, `TasksV2Planner`, `TasksV2Connected`.
- `TasksV2Settings` provides import/export and account diagnostics.
- `TasksNotifications` provides task notifications.
- `TaskCollaboration` is retained and reused for workspaces, invitations, comments, task delegation and attachments.
- `ModuleTaskWidgets` is retained for existing Connect CRM and Learning Portal linkage.
- `app/tasks/collaboration.css` retains only the CSS necessary for shared collaboration UI.

**Do not delete existing `/api/tasks` or `/api/tasks/v2` endpoints or their database functions.** These are actively used by the unified application even though the visible URL no longer contains V2.

## Development restrictions

Changes made on `feature/my-tasks-v2` only. Development Supabase is `fflejkqcspivnhsmkdtn`. Production Supabase `njyktzenybimykpqaegn` was not modified. No merge or deployment is approved.

## Local verification

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

Use a **Development Supabase** `.env.local`. Browser UAT and the build are release gates. No successful local build has been verified by the GitHub-only connector session.

## Compatibility checklist

- The main **My Tasks** link from the Learning Portal and Connect CRM opens `/tasks`.
- Existing task-only users still activate through `/tasks/welcome`.
- Recurrence, reminders, collaboration, assignments, task import/export, task notifications and module-linked tasks remain functional.
- Source-linked task cards open in the unified Connected Work drawer.
- All old navigation links are redirect shims, not duplicate UIs.
