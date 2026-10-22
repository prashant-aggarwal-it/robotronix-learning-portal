# Application handbook — Robotronix™ Learning Portal

## Purpose

Robotronix manages the operational lifecycle of robotics/STEM learners: family intake, enrollment, trainer allocation, schedules, online classes, attendance, progress, billing, communication and renewal. It is a **private learning-operations portal**, not the public marketing website.

## Who uses it

| Role | Entry point | Primary activities |
| --- | --- | --- |
| Admin | `/admin` | Intake, courses, students, trainers, enrollments/cohorts, schedules/classes, demos, Zoom, invoices/finance/payroll, alerts/audit |
| Trainer | `/trainer` | Availability/schedule, sessions, attendance, progress, projects, earnings, messages |
| Parent | `/parent` | Family setup, learner overview, upcoming sessions/calendar, progress, messages |
| Student (optional) | `/student` | Course, projects/portfolio, progress and calendar |

**Important:** Student login is optional; a family can access a learner through Parent without a separate Student credential. Role access is enforced in the app and must also be protected by Supabase permissions/RLS.

## Where to find major capabilities

| Capability | Primary pages |
| --- | --- |
| Intake and family setup | `/onboarding`, `/admin/onboarding`, `/admin/onboarding/[id]` |
| Learner, trainer, course catalog | `/admin/students`, `/admin/trainers`, `/admin/courses` |
| Enrollments, cohorts | `/admin/enrollments`, `/admin/batches` |
| Calendar/classes | `/admin/schedule`, `/admin/classes`, `/trainer/classes`, `/parent/calendar` |
| Scheduling V2 (preview), cohort scheduling | `/admin/scheduling-v2`, `/admin/cohort-scheduling` |
| Holds and cancellation review | `/trainer/holds`, `/admin/cancellation-reviews`, `/admin/enrollments` |
| Progress/projects | `/admin/progress`, `/trainer/progress`, `/student/portfolio` |
| Zoom classroom & recordings | `/admin/zoom`, `/classroom/[scheduleEventId]` |
| Demos | `/admin/demos`, `/trainer/demos`, `/demo/[token]` |
| Invoices/finance | `/admin/invoices`, `/admin/finance`, `/admin/trainer-finance` |
| Messages/alerts/audit | `/admin/messages`, `/admin/alerts`, `/admin/audit` |
| System logs and portal access | `/admin/system-logs`, `/admin/account` |

## Operational principles

- Admin reviews intake and makes assignments; avoid bypassing the portal with direct table edits.
- One parent/family may have multiple linked learners; avoid duplicate family records.
- Choose the correct enrollment mode: one-to-one or small group/cohort, with online/offline/hybrid delivery and a valid time zone.
- Schedules, attendance, delivered minutes and progress have different meanings. Do not treat a scheduled lesson as a completed lesson.
- Preserve historical migration data for learners joining the portal mid-course; do not create fake attendance or payment receipts.
- Preserve historical earnings, invoices and recorded attendance. Use supported correction, hold and rescheduling workflows rather than deleting history-bearing records.
- Parent-visible learning notes and internal Trainer/Admin notes must stay separated.
- Trainer availability supports multiple daily slots and date overrides; scheduling uses overlap checks. Admin-facing notification behavior requires DEV cross-role acceptance.
- User-selected **Classic** and **AI Flow** appearance choices are presentation preferences stored in the browser's local storage; they do not synchronize across devices and do not change permissions or course curricula.
- Cancellation, holds, payroll and payment edits have approval/guard rules. Record the lifecycle instead of silently replacing historical state.
- Zoom recordings default to 60 days but may have host/recording exceptions and protected records. Expiration initiates a Zoom Trash action only when the scheduled function and permissions operate correctly.
- Always check provider environment/mode before doing Zoom or Razorpay write actions.

For operational steps, read [Workflows](WORKFLOWS.md), [Zoom](integrations/ZOOM.md) and [Razorpay](integrations/RAZORPAY.md).

## Implementation orientation

- Routes/UI: `app/`, `components/`
- Data access and domain logic: `lib/`
- Automated QA: `qa/`, `playwright.config.ts`
- Database: `database/`
- Scripts: `scripts/`
- Netlify config: `netlify.toml`
- Environment variable template: `.env.example`

This handbook reflects verified routes and documented product intent; some provider-dependent flows require validation on the actual deployed site.
