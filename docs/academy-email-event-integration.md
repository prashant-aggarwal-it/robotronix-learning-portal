# Academy Email — Event Integration

The internal worker now discovers events from tenant-owned legacy Academy records and queues enabled academy emails before dispatching. Sources: active enrollments (recent 7 days), progress updates (recent 7 days), same-date scheduled classes, unpaid invoices due within 14 days, and trainer schedule reminders. Member invitations are queued at creation. Recipient validation requires both student and enrollment ownership matching the academy organization; trainers must be tenant-owned and class enrollment tenant-verified. All notifications use an explicitly connected academy provider and preferences; platform SMTP is never used.

Operational requirements:
1. Deploy the code and migrations only after CI and a two-tenant end-to-end QA.
2. Configure Google/Microsoft OAuth or academy SMTP, encryption key, invitation app origin, worker endpoint and worker secret. Scheduled GitHub Actions dispatch is active only on default branch with configured secrets.
3. Use a dedicated transactional delivery service for managed email if that product decision is made; this implementation supports BYO providers only.
4. Confirm legacy enrollment and schedule statuses, timezone behavior, recipient consent and finance status against actual fixtures before enabling any academy.
5. Review class reminders: the current implementation sends on the calendar date of a class, not a configurable interval before its start. The job is idempotent per event/date; fee reminders are idempotent per invoice/day.
6. Add monitoring and cursor-based pagination before scaling beyond the current bounded scan (a rotating window of 10 organizations per run, 150 most-recent enrollments per org). Current worker can exceed serverless execution time for large datasets; cursor-based record pagination and workload limits remain necessary.
7. Email provider acceptance is not proof of inbox delivery. Recovered interrupted sends may duplicate an email. Live tests and operational alerting are required.

This is a development integration, not a production certification. No production changes or Netlify builds were performed.
