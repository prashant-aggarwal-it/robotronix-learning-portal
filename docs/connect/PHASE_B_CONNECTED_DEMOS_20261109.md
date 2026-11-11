# Phase B — Connected Demo Management, Development implementation

## Delivered to the feature branch

- CRM Calendar now includes a Learning Portal demo booking panel. CRM counselling appointments remain separate and unaffected.
- Installation/disconnection requires an active CRM owner/admin who is also a Portal admin. The current single-institution Portal permits only one active CRM tenant connection.
- CRM booking identifies a real admission and linked learner, obtains guardian contact data server-side, chooses an active Portal trainer, creates the Portal demo session/guest token and provisions Zoom through the existing Portal service.
- Existing Portal admin demo creation uses the same new `createPortalDemoBooking` service. Group participants and existing trainer/guest pages remain intact.
- Database reservation serializes booking requests per trainer and checks existing scheduled events. Link records have immutable request IDs, canonical payload hash, status/version and Portal references.
- CRM linked bookings can be rescheduled or cancelled with optimistic version checks; trainer and guest experiences remain Portal-owned. CRM reads the authoritative Portal session status in its linked list.
- The Connect schema stays private. Server-only RPC facade is service-role restricted and enforces tenant membership, viewer denial and booking ownership. No direct `connect` schema Data API exposure is required.
- Development migrations: `48_portal_demo_bridge`, `49_portal_demo_move_slot`, `50_portal_single_institution_guard`, `51_portal_demo_private_rpc` applied. Production not changed.

## Known limits / important follow-up

1. This implementation is an **in-process Development adapter** because Connect and Portal currently share a Next.js app and Supabase project. The independent cross-deployment HTTP integration, durable event delivery and reconciliation worker in Phase A are still future architecture. Do **not** call this a production-ready independent SaaS integration.
2. Zoom provisioning is still synchronous. If Zoom succeeds but the CRM link update fails, the link is marked failed for manual review. Do not blindly replay with a new request ID. Add a durable outbox/provider correlation before cross-deployment production rollout.
3. The per-trainer reservation lock protects bookings using the new reservation function. Legacy Portal scheduling paths do not yet take this lock; run a concurrency regression before rollout across all schedule writers.
4. Reschedule/cancel use a multi-step Zoom and database sequence. Failure can require manual reconciliation. The future adapter needs a durable saga, reprocessing and audit reconciliation UI.
5. The current Portal contains a single institution. The single-active-connection guard protects against CRM tenant data mixing; remove only when Portal supports verified institute-scoped isolation.
6. CRM learner must be the admission contact or a linked `opportunity_people` record. Guardian is the opportunity contact, with a mobile/WhatsApp contact method. More complex households and guardian verification belong in Phase C.
7. CRM appointment entries are not automatically created for Portal demos. The connected booking panel maintains its own projection; future calendar projection should display both event types with synchronized status.
8. No real authenticated browser/Zoom UAT was performed without active Development credentials and Zoom test host. **Do not merge/deploy until that passes.**

## Mandatory Development UAT before release sign-off

1. Log in as a dual CRM owner/Portal admin and connect the Portal; verify manager-only installation is rejected.
2. Log in as CRM counsellor; book one demo against an admission and linked learner whose guardian has WhatsApp/mobile.
3. Confirm a single linked CRM booking, Portal `/admin/demos` session, Portal trainer `/trainer/demos` assignment, schedule event, Zoom meeting and one guest link.
4. Repeat the identical request ID with the same payload: no second demo. Repeat with different payload: HTTP 409.
5. Try overlapping slots with two concurrent bookings: only one can reserve. Check legacy admin scheduling conflict separately.
6. Reschedule from CRM: check trainer, Portal session, Zoom start time, original guest link and CRM version; try stale version.
7. Cancel from CRM: confirm trainer, guest and Zoom states. Try cancellation after completion and cross-tenant IDs.
8. Verify CRM viewer cannot see unrelated trainer/demo lists or mutate bookings, and counsellor cannot alter another counsellor's booking.
9. Disable connection; existing Portal sessions stay intact and no new CRM booking is allowed.
10. Run Portal parent/learner, attendance, trainer finance, Zoom recording and onboarding regressions; collect trace IDs for any failure.

## Automated evidence

- `npm run typecheck` passed.
- `npm run check:demo-experience`, `check:security`, `check:zoom-classroom`, and Connect–Portal Phase A contract checks passed.
- `NEXT_PUBLIC_APP_ENV=demo npm run build` passed.
- Supabase Development inspected: bridge tables exist; `anon` and `authenticated` have no direct EXECUTE on private facade; unauthorized tenant context query fails.

## Scope boundary

This is Phase B's first working implementation in the shared Development deployment, **not** completion of Milestone 2. Phase C admission/onboarding handoff and Phase D learning/renewal projections have not been implemented.
