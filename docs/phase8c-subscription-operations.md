# Phase 8C — Subscriptions and operational dashboard

Implemented a platform-admin-only operations summary with bounded batch reads of SaaS subscriptions and pending customer invitations. The dashboard highlights expiring trials (within seven days), expired trials, pending owner activations, expired invitations and past-due subscriptions. The subscription screen shows a tabular overview of subscriptions associated with the current directory page, with context-based management selection.

The backend returns a truncated flag when upper bounds are hit, so the UI does not silently imply global totals for very large deployments. The figures are accurate only below the stated scan caps (1,000 subscription records and 500 pending invitations). This is not a complete platform-wide reporting solution at scale; pagination/aggregate RPCs should be introduced before those caps are approached.

Changes require no database migration or production deployment. CI, two-tenant role verification, boundary-date tests and manual UI checks remain release gates. No Netlify deployment triggered.
