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
| Progress/projects | `/admin/progress`, `/trainer/progress`, `/student/portfolio` |
| Zoom classroom & recordings | `/admin/zoom`, `/classroom/[scheduleEventId]` |
| Demos | `/admin/demos`, `/trainer/demos`, `/demo/[token]` |
| Invoices/finance | `/admin/invoices`, `/admin/finance`, `/admin/trainer-finance` |
| Messages/alerts/audit | `/admin/messages`, `/admin/alerts`, `/admin/audit` |

## Operational principles

- Admin reviews intake and makes assignments; avoid bypassing the portal with direct table edits.
- One parent/family may have multiple linked learners; avoid duplicate family records.
- Choose the correct enrollment mode: one-to-one or small group/cohort, with online/offline/hybrid delivery and a valid time zone.
- Schedules, attendance, delivered minutes and progress have different meanings. Do not treat a scheduled lesson as a completed lesson.
- Preserve historical migration data for learners joining the portal mid-course; do not create fake attendance or payment receipts.
- Preserve historical earnings, invoices and recorded attendance. Use supported correction, hold and rescheduling workflows rather than deleting history-bearing records.
- Parent-visible learning notes and internal Trainer/Admin notes must stay separated.
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
