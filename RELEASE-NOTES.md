# Production V1 Release Notes

Production V1 is the consolidated first release baseline. Historical development migrations, patch notes and hotfix bundles are intentionally excluded.

This release was hardened through automated role and workflow QA. The final release gate completed 59/59 checks successfully before consolidation.

Key production hardening included in this source:
- production-safe Supabase configuration and logout
- role-aware OAuth callback routing
- non-recursive and relationship-aware RLS
- resilient Parent learner experience loading
- public learner-facing course naming
- trainer actual-duration/payroll synchronization
- protected paid-payroll and attendance/class history
- student finance schema and validation
- audit logging that supports composite-key tables
- enrollment edit race protection
- faster protected-route profile checks using the existing browser session
- noindex/robots protection for the private portal
## Final release-candidate verification

- Next.js pinned to **16.3.8** after the security advisory affecting the earlier 16.3.x release.
- Learner-facing Parent/Student identity reads use the existing signed Supabase session consistently.
- Consolidated Production V1 database baseline remains the single fresh-install schema; historical SQL hotfixes are merged into it.
- Clean production build was verified by the user with `npm run typecheck`, `npm run build`, `npm start`, and **59/59** Playwright release tests passing against the production server.
- `xlsx` remains for export-only spreadsheet generation; npm currently reports its known advisory with no npm-published fix. Do not use it to parse untrusted spreadsheet uploads.

