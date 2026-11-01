# Robotronix Portal UI Consistency Audit — 2026-11-01

## Scope and evidence
Reviewed supplied screenshots: Trainers, Courses, Enrollments, Quick Demo Setup, Schedule, Zoom, Students, Onboarding, System Logs. Inspected source in `app/globals.css`, `app/theme.css` (imports), `app/typography.css`, `app/layout.tsx`, `components/admin/{AdminPageHeader,KpiCard,Pagination,GridFilterControls}`, and page implementations for Trainers, Courses, Students, Enrollments, Demos, Schedule, Zoom and System Logs. This is **source and screenshot review**, not automated visual validation of every portal route. Other routes still require QA.

## Design contract (v1)
| Token/pattern | Rule |
|---|---|
| Primary action | One high-emphasis create/save/confirm action per section; 42px default height, 11px radius, blue accent |
| Secondary action | White background and neutral blue-grey border; equal height |
| Utility/row mutation | 34px compact control; caution/danger separated; avoid giant pills |
| Row navigation | Text-link styling; primary cell title prominent but not a button |
| Form labels | 13px / 600; sentence case; avoid unnecessary uppercase |
| Form values | 14px / 400–500; no bold form control text |
| Inputs | 42px default minimum; 10px radius; consistent focus ring |
| Table headings | 12px / 650; cool neutral blue-grey; consistent padding |
| Table cells | 13–14px / normal; supporting text 12px |
| KPI | ~29px value, 11px label, 12.5px detail; restrained accents |
| Tabs | Neutral pill rail; soft selected state rather than large filled button |
| Keyboard | Visible focus indicators, no focus suppression |
| Responsive | Form one column on mobile; table horizontal scroll if truly needed; compact schedule navigator |

## Findings and priority

### P0 — consistency, legibility and usability
1. **Mixed action hierarchy**: Several `.button`, `.button.secondary`, `.button.ghost`, feature-specific `.zoomActionButton`, `.tableAction`, navigation link variants. Identical actions have inconsistent weights/gradients.
2. **Form typography disproportionate**: Quick Demo, Create Meeting and schedule forms use inherited font-weight 800 and uppercase labels, making actual data feel equally loud as headings.
3. **Grids are not a single family**: Some screens use `professionalTable` with shared pagination; others use raw `tableWrap`. Header size/color, cell padding, and actions diverge.
4. **Calendar navigation**: Schedule Previous/Today/Next controls become vertically stacked and oversized at some viewport widths.
5. **Table horizontal overflow**: Trainer and Course grids have minimum-width rules (at least 1180px). Preserve scrolling for dense data but test at 1366px and 1280px; avoid clipping the Action column; evaluate optional columns/compact layouts.

### P1 — component architecture
6. Consolidate all row links on `TableRowLink` and all action buttons on `UiButton` instead of relying on global CSS forever.
7. Migrate raw data tables to a shared grid shell with header, search, filter alignment, empty state, row density, pagination, and sticky action affordance.
8. Use one form field component, including aria-invalid/error states and consistent helper text; current raw labels and formGroup differ.
9. Normalize KPI cards: `KpiCard` reused in catalogue screens, `experienceKpi` used in Zoom and Demo; same visual hierarchy desirable.
10. Normalize tab primitives across Schedule, Enrollment and Zoom.
11. Reduce redundant section eyebrows and oversized titles; preserve clear page hierarchy.
12. Set a deliberate menu/overflow strategy for >2 row-level mutations, with keyboard/focus testing.

### P2 — visual polish and full route audit
13. Verify all Admin, Trainer, Parent and Student pages at 1440px, 1280px, tablet and mobile widths; capture reference screenshots.
14. Replace ad-hoc feature CSS progressively rather than extending global overrides indefinitely.
15. Test colored statuses for contrast, reduced-motion preference and keyboard navigation.
16. Define export patterns and consistently name CSV vs Excel without changing scope or export content.
17. Check empty/loading/error states, fixed floating controls (Module activity), responsive tables, and long translated content.

## Implemented in this branch
- `app/ui-foundations.css` shared visual tokens and scoped refinements for primary/secondary/compact actions, forms, labels, tables, KPI, tabs, pagination and schedule controls.
- Layout import last so new foundation takes precedence over legacy typography.
- Better hierarchy for Quick Demo Setup and Zoom general meeting form.
- Existing business logic, roles, filters, Zoom OAuth/recording APIs and database remain unchanged.

## Acceptance checklist before merge
- Run typecheck, structural regression, scheduling preview and Next.js build.
- Browser smoke test: Trainers, Courses, Students, Enrollments, Onboarding, Demos, Schedule, Zoom, System Logs.
- Confirm form inputs remain enabled/validated and no values/labels clipped.
- Confirm actions and their busy/disabled states; compare click targets at mobile.
- Verify Schedule toolbar layout at >=1440, 1280, 768, 390px.
- Check sorting/pagination, horizontal scrolling and Action column access.
- Check all role portals; CSS scope is `.workspaceShell`, so apply separate patterns to `.experienceShell` where required.
- No production deploy without merge/deployment verification.

## Next implementation tranche
Implement semantic shared React components (UiButton, UiLink, UiBadge, UiTabs, UiFormField, DataGridShell) and migrate high-traffic screens in small PRs, rather than a single fragile find/replace through the entire repository.
