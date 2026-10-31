# Family & Student Access — DEV verification

Scope: Admin → Students → learner profile → Family & Student Access.

## Expected behaviour
- View linked guardian email, primary/additional relationship, account enabled status, first-login status, last sign-in, and all children linked to each parent account.
- A newly manually created learner with no family account shows an empty state and points to the existing Parent Portal Access panel.
- Existing *active* parent account can be linked as an additional guardian only after admin confirmation. Duplicate link and wrong-role account are rejected.
- Removing an additional guardian revokes access to **this learner only**. Sibling links and the underlying Auth account remain unchanged.
- Promoting an existing linked guardian updates the learner's primary login email. Old primary access remains linked as an additional guardian until separately revoked.
- Changes to the primary email via profile editing trigger existing link review, and the separate additional-guardian links are not deleted by primary replacement.
- Only admins can read or mutate family links. Responses contain no service-role key.
- An account provisioned but never signed in is not shown as signed in.
- Refresh after an action reflects current persisted state, not optimistic UI.

## Recommended DEV test matrix
1. New learner without links.
2. Primary parent with two children; inspect both on each child profile.
3. Add an existing second guardian, then verify first and second guardians can see only their authorized learners.
4. Promote the second guardian; inspect primary email on a fresh load.
5. Remove previous primary (now additional); verify sibling access remains.
6. Attempt removal of current primary (must reject).
7. Attempt duplicate link, unknown email, disabled user, or trainer-role user (must reject).
8. Change family account email in learner profile, run primary replacement, verify unrelated additional guardian is preserved.
9. Sign in as a new parent and verify first-sign-in timestamp refresh.
10. Attempt GET/POST without authorization, with parent token, and with trainer token (must deny).
11. Verify audit records and sanitized System Logs after failed operations.

## Deployment
This panel uses the existing `parents`, `parent_students`, `profiles`, `student_guardians`, and `portal_audit_log` objects; it introduces no new schema objects. Run all tests on DEV with disposable users before merging.
