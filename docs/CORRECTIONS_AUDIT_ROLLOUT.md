# Corrections & Audit — usability and governance review

## Implemented in PR #37
- Safe before/after field comparisons on the audit history screen, using the existing allowlist in `lib/audit-display.ts`. Technical JSON remains collapsed and sanitized.
- Clear distinctions between named user, unresolved user and unattributed (system or unknown) audit events. We do **not** claim an unattributed event was automated without source evidence.
- Record links for known admin routes and safe title/code label when available; other records retain an identifier and category without making up a human-readable name.
- Zoom / Finance / Classes / Learners / Other quick category filter, retaining original type/action/date/ID filters and Excel export.
- Correction request transitions constrained to Open → Approved or Rejected, and Approved → Completed. Rejection and completion require notes. Completion requires confirmation that the underlying record was actually corrected.
- Existing Admin-only RLS and audit history remain in place. No new audit-data payload fields or schema changes.

## Important operating rule
Approval **does not** edit a protected record. Admin must apply the change on the owning screen, verify it, and then choose Complete. An internal note is required; changing status is a workflow record, not proof of an underlying change.

## DEV QA
1. Confirm a trainer creates a correction request; Admin sees it as Open.
2. Approve; verify underlying data is unchanged until Admin edits it in the owning screen.
3. Verify the completion confirmation and required note, then complete.
4. Rejection requires reason; a second update using stale status should be rejected.
5. Open audit history entries for Zoom, enrollment, class and finance. Verify safe Before/After diffs, redacted fields, source actor and UTC-to-IST formatting.
6. Test category filters, record links, date range, 25-item display pagination and filtered Excel export.
7. Verify Admin-only access for both correction requests and audit log under RLS. Inspect exported workbook for sensitive fields.
8. Verify unknown actors remain unattributed rather than being incorrectly attributed to an automation.

## Known limits / future hardening
- The current audit history loads the **most recent 2,000 entries** into the browser and paginates there. It is not a full server-side historical search. Do not claim comprehensive long-term search from this page.
- Some events have no human-readable record label or actor identity. If a name cannot be derived from approved safe fields, a truncated record ID and explicit attribution state are shown; definitive actor provenance requires instrumentation at the original write location.
- Correction completion currently relies on Admin confirmation and notes. It does not automatically verify the owning record was modified. A transactional operation-specific workflow would be needed for automatic enforcement.
