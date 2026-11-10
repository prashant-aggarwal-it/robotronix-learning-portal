# My Tasks — personal and collaborative workspace

Route: `/tasks`. Subviews include `/tasks/inbox`, `/tasks/all`, `/tasks/assigned`, `/tasks/delegated`, `/tasks/team`, `/tasks/board`, `/tasks/calendar`, `/tasks/review`, `/tasks/settings`.

The UI uses the existing signed-in browser session and calls authenticated `/api/tasks` handlers. No service-role credential is bundled into the browser. The database schema is private and the API uses service-role-only RPCs with a verified actor ID.

## Phase 2 interactions

- My Day overview and three focus priorities
- Quick capture, full edit drawer, archive/reopen/complete
- Personal categories, due/scheduled dates, reminders, recurrence
- Subtask checklist, status board, list filters, calendar, weekly review
- Personal timezone and week-start preferences
- Responsive desktop and mobile layout, navigation from existing Portal roles

## Phase 3 collaboration (Development only)

- Team Spaces: create a workspace, invite a verified-email colleague, accept invitations, view and remove members.
- Workspace task creation and optional delegation; existing personal tasks can be deliberately shared by their owner.
- Task visibility is restricted by default. A workspace member can see a task only if they own it, are assigned, are an explicit collaborator, or the owner enables workspace-wide visibility.
- Assigned to Me and Assigned by Me views; task comments, permissions-aware collaborators, activity history and private PDF/image/text attachments (10 MB max).
- Assignees may update status and their checklist items; task owners can edit, assign and archive. Workspace administrators do not automatically inherit access to restricted tasks.
- Invitations are **in-app only** and appear when the recipient signs in with the matching verified email. The system does not send invitation emails yet.
- Files are stored in the private `task-attachments` Supabase bucket. Download URLs expire after 60 seconds.
- No CRM or Learning Portal record is implicitly shared or linked. Future module integrations must obtain explicit authorization.

## Before UAT

The development database migrations are installed, but the feature branch is not deployed. A signed-in browser session is required to verify the real user journey. In addition to personal-workspace tests, test invitations across two verified accounts, restricted versus workspace-visible tasks, assignment/status permissions, member revocation, comments and attachment downloads. Ensure the deployment uses the Development database, not Production.

## Phase 4 module integrations

- CRM follow-up board: see the user's linked tasks, and individually copy existing CRM follow-ups into My Tasks. Contact and admission detail panels offer independent personal follow-up tasks.
- Learning Portal class lists: show linked review tasks; class detail pages for Admin/Trainer let the authorized person create a personal review task.
- My Tasks shows module origins and offers a link back to the module; `?task=<uuid>` opens a particular linked task. Completion of an imported CRM task is synchronized, while completion of a personal contact/admission/class review has no effects on business outcomes.
- Integration is opt-in and owner-scoped; no automatic source-task migration or change to the Connect/Portal normal workflows.
- UAT must check real signed-in roles, duplicate imports, CRM completion in each direction, revoked CRM membership, class access, mobile presentation, and absence of changes to attendance/finance. The branch is not deployed or merged.

## Phase 5 task-only product readiness

- `/tasks/welcome` is the standalone activation path for a user who has authenticated with Supabase but has no active Learning Portal profile. Entry through `/login?next=/tasks/welcome` preserves the intent across password, email-code and Google sign-in. Verified email is required to activate an account.
- `GET/POST /api/tasks/onboarding` manages the caller's task-only account without allowing self-assigned Portal roles. Disabled Portal users and suspended task accounts remain blocked.
- Settings → Import & export provides UTF-8 CSV export, JSON export, CSV preview, manual field mapping, and confirmed atomic import of up to 200 personal tasks per batch. Export excludes all teammates' shared work. CSV values are escaped for spreadsheet safety.
- Settings → Account snapshot displays private, per-user task and workspace counts, linked-record counts and the API response duration.
- Task-only users receive reminders and assignments in a private My Tasks notification popover. Existing Portal-role users continue using their usual Portal notification bell. These notifications require the existing reminder worker to be deployed and operational.
- Automated gates: `npm run check:tasks`, `npm run test:tasks`, `npm run typecheck`, and `npm run build`. These do not substitute for signed-in browser QA and multi-identity security testing.
- Task list loading now uses bounded four-page concurrent batches, rather than a sequential waterfall, with ID deduplication for records that shift during pagination. Real large-tenant load tests are still required.
- **Commercial rollout is not authorized.** No external email delivery, paid plans/billing, general public marketing signup, main-branch merge or Production migration is included. Continue to a controlled feature-branch UAT before release.
