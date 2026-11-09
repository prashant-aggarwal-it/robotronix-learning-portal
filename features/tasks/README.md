# My Tasks personal workspace

Route: `/tasks`. Subviews: `/tasks/inbox`, `/tasks/all`, `/tasks/board`, `/tasks/calendar`, `/tasks/review`, `/tasks/settings`.

The UI uses the existing signed-in browser session and calls authenticated `/api/tasks` handlers. No service-role credential is bundled into the browser. The database schema is private and the API uses service-role-only RPCs with a verified actor ID.

## Phase 2 interactions

- My Day overview and three focus priorities
- Quick capture, full edit drawer, archive/reopen/complete
- Personal categories, due/scheduled dates, reminders, recurrence
- Subtask checklist, status board, list filters, calendar, weekly review
- Personal timezone and week-start preferences
- Responsive desktop and mobile layout, navigation from existing Portal roles

## Before UAT

The development database migrations are installed, but the feature branch is not deployed. A signed-in browser session is required to verify the real user journey. Recommended manual tests: create, edit, archive and reopen; fill/remove focus spots; create a subtask; check a month-end recurrence; set a short reminder; test keyboard/phone layout and role isolation. Ensure the deployment uses the Development database, not Production.
