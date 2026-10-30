# Robotronix Typography Audit — 28 October 2026

## Scope
Shared styles reviewed for Admin, Trainer, Parent and Student via app/layout.tsx,
app/globals.css, app/readability.css, app/theme.css, app/schedule-unified.css,
components/AppShell.tsx and core list / KPI components.

This is a static CSS and component audit, not a comprehensive authenticated
browser screenshot comparison of every route.

## Findings and corrections
| Area | Previous inconsistency | Shared rule |
| --- | --- | --- |
| Admin/Trainer data grids | Header 12px; cells 14.5px; secondary 12.5px | Header 13px, primary 14px, secondary 13px |
| Grid actions and badges | Independent 13px actions and 11.5px badges | Actions 13px, badges 12px |
| Admin/Trainer sidebar | 13.5px weight 720 vs grid | 14px, weight 600 |
| Workspace cards | Varied heading and supporting text | Heading 21px / 700; secondary 13px |
| Page titles | Hard-coded font-size | Fluid 28–36px token, weight 700 |
| Admin/Trainer toolbars | Fixed 14px with !important | 14px shared token |
| Parent navigation and billing tabs | Distinct handwritten values | Shared 14px and 13px tokens |
| Smaller screens | Grid text sometimes shrank to 11.5px | Maintain header 13px, primary 14px |

## Design-system source of truth
- `app/typography.css` declares `--rx-text-*`, `--rx-weight-*`, `--rx-leading-*`, `--rx-text-primary`, and `--rx-text-secondary`.
- It is imported **after** the older feature and theme styles in `app/layout.tsx`.
- `app/readability.css` contains historical `!important` grid declarations; the targeted typography layer uses an explicit later import to take precedence without restructuring a large legacy stylesheet.
- Keep the existing Inter/system font stack. No font files are downloaded or distributed.
- Layout and spacing rules remain in feature stylesheets. Typography tokens should not silently affect grids' overflow, sticky headers, click targets or form logic.

## Follow-up visual acceptance checks (required before merge)
1. Admin: Onboarding, Students, Trainers, Courses, Enrollments, Schedule, Classes, Alerts, Finance, Invoices, Payroll, Progress, Messages, Notifications.
2. Trainer: Home, Calendar, Classes, Courses, Progress, Earnings, Messages.
3. Parent: Family Dashboard, Calendar, Fees & Payments, Family Profile, Messages.
4. Student: Home, Course, Projects, Notifications.
5. For each role, inspect at approximately 1440px, 1024px, 768px and 390px.
6. Confirm tables remain horizontally scrollable; headers and actions are readable without clipped or overlapping text.
7. Confirm zoom at 125% and 200%, hover/focus states and forms with validation messages.
8. Check Classic and AI Flow separately, including loading, empty, error and dense data states.
9. Check labels, mixed-case names, long countries and currencies, and multi-line data cells.

## Rules for future development
- Prefer an existing `var(--rx-text-*)` token rather than adding arbitrary pixel values.
- Use primary 14px and secondary 13px in operational grids.
- Avoid font weights above 700 in ordinary UI and do not use all-caps for primary body content.
- Reserve very small type for nonessential metadata; do not shrink dense grids further on mobile.
- Make changes at shared component level when the same pattern appears on multiple routes.

## Status
Shared type scale and representative cross-role selectors implemented on QA branch.
Full browser screenshot audit and per-route exception inventory remain pending.
