# Robotronix — Post-release improvement backlog

**Purpose:** Capture non-blocking refinements as they are discovered and implement them together in a later, controlled release. This list is separate from the Production stabilization/QA gate. **Items below are tracked with implementation status; source changes require local verification before release.**

| ID | Area | Requested improvement | Priority | Status |
|---|---|---|---|---|
| UI-001 | Trainer → My Courses | Show each Admin-approved course as a separate responsive card instead of a run-on line of text. | Medium | Implemented in branch; QA pending |
| UI-002 | Trainer → My Courses | Remove Beginner/Intermediate/Advanced descriptors from approved-course cards. Robotronix has not divided individual catalogue courses into level-specific offerings, so the labels are misleading. | Medium | Implemented in branch; QA pending |
| UI-003 | Trainer → My Courses | Use clear heading **Approved Courses** and keep **Currently Teaching** (active learner/cohort assignments) separate. | Low | Implemented in branch; QA pending |
| UI-004 | Course displays | Audit other screens for level labels that imply separate offerings; remove misleading display text without changing course records, permissions or catalogue. | Medium | Implemented in branch; QA pending |

## Implementation constraints
- Preserve existing Admin-approved course permissions and active-assignment logic.
- Do not create additional course levels, courses or database records for these presentation changes.
- Implementation was explicitly approved on 2026-10-21, but no database or Production changes are made as part of this UI work.
- At that time, test desktop/mobile layouts, role-based visibility, and regression of Admin permission changes.

## How to maintain
Add each new observation as the next sequential ID, with page, current behavior, desired behavior, priority and status. Batch fixes and verify them before marking complete.

## Implementation — 2026-10-21

UI-001/002/003 implemented in `app/trainer/courses/page.tsx` and `app/globals.css`: approved-course grid with individual cards, course names only, unambiguous Approved Courses heading and separate Currently Teaching section. UI-004 audit: Trainer My Courses was the identified user-facing use of `c.level`; Admin course catalogue retains underlying difficulty metadata and its administrative filter because the course catalogue/schema should not be changed. No new courses, levels or database alterations. Static regression check: `npm run check:trainer-courses-ui`. Local build/mobile testing pending; changes are not deployed.
