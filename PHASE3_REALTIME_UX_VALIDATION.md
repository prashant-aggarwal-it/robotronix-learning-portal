# Phase 3 — Realtime and UX validation checklist

Branch: feature/production-hardening-v1

## Implemented in this pass
- Shared live refresh coalesces bursts of database events, serializes API refreshes and avoids stale-page refresh while hidden/offline.
- Reconnect, focus, visibility and a 60-second visible-page recovery refresh ensure views update even where RLS blocks direct Postgres event delivery.
- Admin Demo avoids a second notification-driven API refresh path alongside the shared hook.
- Trainer Demo controls now distinguish opening the room from recording an outcome, and label prior outcomes accurately.
- Structural release checks include the recovery and duplicate-refresh safeguards.

## Deliberately not changed
- No broad database Realtime SELECT policies were added. Sensitive queues, finance and student rows should remain accessible through role-protected APIs, not indiscriminately exposed by browser change streams.
- Zoom and Razorpay data remain authoritative only after backend sync/webhook reconciliation, not direct client subscriptions.

## Required validation before production
1. Login as Admin, Trainer, Parent and Student in distinct browser sessions. Create, cancel, reschedule and complete classes; verify each authorized dashboard reflects changes within 60 seconds and disallowed roles cannot read unrelated records.
2. For onboarding, attendance, progress, invoices and earnings, modify records as Admin; verify allowed views refresh and protected fields never appear in unintended role API responses.
3. Disable network briefly, restore, change tabs and resume; verify one current data load and no repeated subscription loops.
4. Test webhook delivery plus Zoom Sync and Razorpay reconciliation; ensure UI never claims provider status based solely on browser state.
5. Verify Demo guest requests, parent summary and Trainer outcome updates; inspect duplicate notifications and request rates.
6. Execute npm run typecheck, npm run build, npm run check:release, QA role/workflow suites and browser/manual accessibility review.
7. Audit remaining legacy Admin forms, terminology and disabled actions page-by-page. The structural script cannot certify visual and interaction consistency.

No staging/production deployment or live role testing was performed in this implementation pass.
