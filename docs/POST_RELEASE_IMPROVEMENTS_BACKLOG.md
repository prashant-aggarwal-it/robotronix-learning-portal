# Robotronix — Post-release improvement backlog

**Purpose:** Capture non-blocking refinements as they are discovered and implement them together in a later, controlled release. This list is separate from the Production stabilization/QA gate. **Items below are NOT implemented.**

| ID | Area | Requested improvement | Priority | Status |
|---|---|---|---|---|
| UI-001 | Trainer → My Courses | Show each Admin-approved course as a separate responsive card instead of a run-on line of text. | Medium | Pending |
| UI-002 | Trainer → My Courses | Remove Beginner/Intermediate/Advanced descriptors from approved-course cards. Robotronix has not divided individual catalogue courses into level-specific offerings, so the labels are misleading. | Medium | Pending |
| UI-003 | Trainer → My Courses | Use clear heading **Approved Courses** and keep **Currently Teaching** (active learner/cohort assignments) separate. | Low | Pending |
| UI-004 | Course displays | Audit other screens for level labels that imply separate offerings; remove misleading display text without changing course records, permissions or catalogue. | Medium | Pending |

## Implementation constraints
- Preserve existing Admin-approved course permissions and active-assignment logic.
- Do not create additional course levels, courses or database records for these presentation changes.
- Avoid modifying Production code or schema for these items until a future implementation round is explicitly approved.
- At that time, test desktop/mobile layouts, role-based visibility, and regression of Admin permission changes.

## How to maintain
Add each new observation as the next sequential ID, with page, current behavior, desired behavior, priority and status. Batch fixes and verify them before marking complete.
