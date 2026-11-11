# Gate 0 — Read-Only Baseline Audit and Phase A Entry Report

Date: 2026-11-09  
Status: **Gate 0 source/database baseline completed; Phase A can begin with listed blockers. Live authenticated UAT and migration reconciliation remain required before implementation rollout.**  
Scope: EdTech-only Robotronix Connect + Learning Portal, no product/database writes.  
Baseline GitHub: `main` at `47b48e839fade7458990d753a2fd208bfd97cf6b`; `feature/robotronix-connect-crm` at `e27d5553ae8ecf55f58608d63a969cc0bbd5e0dc` before this report.

## Executive decision

**Do not build a second demo engine in Connect.** Portal is authoritative for demo session, trainer scheduling and Zoom; Connect manages prospect relationship and booking intent. Introduce a Portal-owned, permission-scoped booking service and durable external links. Do not let CRM call the admin-only demo endpoint with elevated credentials. Preserve Portal-only and Connect-only modes.

**Ready now:** Phase A contract and schema reconciliation design.  
**Not ready:** Phase B production-capable integration coding, production DB migration or deployment until the P0 issues below are resolved and tested.

## 1. Evidence inventory and branch reconciliation

| Check | Finding |
| --- | --- |
| GitHub source | `origin/main` is an ancestor of `origin/feature/robotronix-connect-crm` at audit time; ~168 file paths differ. Existing Portal code is present in feature branch. |
| Local branch | Local commits differ in SHA from GitHub commits created through the connected GitHub integration, although previous changes were published with matching file content; reconcile branch refs before future conventional pushes/cherry-picks. |
| Connect product architecture | `docs/connect/SAAS_ARCHITECTURE_DECISION.md`: standalone multi-institute SaaS, optional Portal adapter, private `connect` schema in DEV as interim implementation. |
| Portal demo | `app/admin/demos/page.tsx`, `app/api/admin/demos/route.ts`, `app/api/demos/trainer/route.ts`, `app/api/demo/[token]/route.ts` are active source paths. |
| Connect calendar | `features/connect/components/ConnectCalendar.tsx`, `app/api/connect/workspaces/[tenantId]/calendar/route.ts`, `database/connect/saas/39_calendar_management.sql`: CRM appointments, including kind `demo`, are separate from Portal `demo_sessions`. |
| Integration placeholders | `connect.integration_connections` and `connect.external_links` exist; no Portal adapter API or event contract found in current route inventory. |

This is a source inventory, not evidence that every route has been exercised with live credentials.

## 2. Development and Production database metadata (read-only)

Two distinct Supabase projects are accessible:

- **Development**: `fflejkqcspivnhsmkdtn` (Tokyo region ap-northeast-2), active/healthy.
- **Production**: `njyktzenybimykpqaegn` (ap-northeast-1), active/healthy. No SQL writes performed against either.

Read-only metadata findings:

| Item | DEV | PROD |
| --- | --- | --- |
| Portal `public` tables | 80 | 80 |
| Connect `connect` tables | 60 | No `connect` tables returned |
| RLS | All 80 Portal and all 60 Connect ordinary tables enabled | Not re-audited beyond compact table listing |
| `connect` schema usage for `anon`/`authenticated` | Denied | Not applicable |
| Direct Connect-to-Portal FK | None found | Not applicable |
| Recorded DEV migrations | 51, latest `20261108010841` (`connect_calendar_management_fields`) | Not queried |

DEV approximate planner statistics at audit time (non-PII, **not exact row counts**): one Connect tenant, one membership, ~12 people, ~12 inquiries, 8 opportunities, 8 appointments, five pipeline stages, zero integration connections and zero external links. DEV Portal operational tables appeared empty in compact list; treat those estimates as non-authoritative and do not infer test readiness from them.

**Migration-history reconciliation required:** DEV contains `contact_import_batches`, `contact_profiles`, `contact_saved_segments`, `contact_duplicate_decisions` and the contact-management/directory functions corresponding to source files `40`–`47`. The migration ledger's latest name is the calendar migration and does not present these source scripts as separately named migration entries. Determine whether they were applied in bundled migrations or manual SQL, compare definitions/checksums against repository and produce a repeatable clean install/migration plan before new DDL. Do not replay scripts blindly.

## 3. Existing Portal demo operational contract

Verified in source:

- Admin can create 1:1/group demo, assign trainer, add group learner, reschedule, cancel, regenerate guest link and mark lead status.
- Trainer uses `app/api/demos/trainer/route.ts` for participant feedback and attendance; completion updates demo/session schedule state.
- Guest link uses hashed token and expiry; participant receives scoped pre-onboarding access.
- Demo booking creates `demo_leads`, `schedule_events`, `demo_sessions`, `demo_session_participants` and a Zoom meeting, plus trainer notification.
- Trainer conflict is checked by reading overlapping `schedule_events` and comparing time windows.

**P0 architectural risk:** current `POST /api/admin/demos` uses `requireAdmin`; it cannot be safely reused as a general CRM booking API. The create/reschedule/cancel operations perform multiple sequential database and external Zoom requests. The create path attempts compensation on failure, but there is no durable idempotency record, cross-process lock or atomic slot reservation. Concurrent requests and lost responses require additional hardening before a cross-product caller is introduced. The reschedule path updates Zoom before all local records and may need reconciliation if a later write fails. The API also contains a duplicated reschedule status guard with a misleading cancellation message.

**Design response for Phase A:** extract a Portal-owned booking domain service, versioned externally scoped API, idempotency key and durable request/outbox ledger, conflict-safe slot reservation, recoverable Zoom provisioning, state/version controls, and minimal learner data. Retain current Portal admin UI as a caller of the same service.

## 4. Connect operational contract and overlap

- Connect supports enquiries, opportunities, follow-ups, ordinary appointments, contacts and pipeline stage transitions.
- Connect calendar's `kind='demo'` currently represents a CRM appointment; it is **not** a Portal demo/session ID or guaranteed Zoom meeting.
- Connect user permissions are enforced via authenticated tenant-scoped RPC wrappers for CRM and calendar APIs; this does not confer Portal trainer/finance authority.
- `connect.integration_connections`/`external_links` can become the basis for per-tenant Portal mappings, with appropriate lifecycle and uniqueness review.
- No verified cross-product identity link, demo booking/feedback projection, enrollment handoff, or finance summary flow exists yet.

**Design response:** define separate `sales_appointment` vs `linked_academic_demo` semantics. CRM must never synthesize Portal booking state or mark enrollment confirmed on its own.

## 5. Security and operational advisors — Development only

Supabase security advisors returned the following current notices (counts are findings, not confirmed exploits):

| Advisory | Count | Interpretation / action |
| --- | ---: | --- |
| RLS enabled but no policy | 88 | 60 in private Connect schema are intentional deny-by-default; 28 in `public` require classification |
| Mutable function search path | 9 | Portal `public` functions; review privilege and explicit search path |
| Extension in `public` | 1 | `btree_gist`; review safe relocation feasibility |
| Anonymous execution of security-definer functions | 39 | **Review grants and internal authorization; potentially high-impact** |
| Authenticated execution of security-definer functions | 57 | Review least privilege, function bodies and RLS bypass assumptions |
| Leaked-password protection disabled | 1 | Auth configuration review |

Performance advisors additionally returned: 103 unindexed FK notices, 25 auth-RLS initplan, 68 unused-index notices, 261 multiple-permissive-policy and two duplicate-index notices. These need triage against real workloads, not blanket index/policy changes.

Advisory URLs: [RLS no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [function search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [anonymous definer grants](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated definer grants](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**P0 before external integration:** examine externally executable privileged functions, cross-tenant authorization and integration key scoping. Source-only security check success is not a penetration test or a live role test.

## 6. Safe verification results

| Check | Outcome |
| --- | --- |
| `npm run typecheck` | PASS |
| `NEXT_PUBLIC_APP_ENV=demo npm run build` | PASS, Next.js 16.4.3, 85 static pages generated |
| `node scripts/check-connect-code-layout.mjs` | PASS |
| `node scripts/check-connect-db-layout.mjs` | PASS, 37 source SQL files and 7 verification scripts |
| `node --test lib/server/connect-history-batches.test.mjs` | PASS, 3/3 |
| `npm run check:demo-experience` | PASS (structural) |
| `npm run check:security` | PASS (source structural; not security penetration test) |
| `npm run check:zoom-classroom` | PASS (structural) |
| Supabase DEV health advisors | No health lints returned |
| Authenticated browser, Zoom real meeting, Razorpay, trainer/parent/student integration UAT | **NOT RUN**; needs prepared test identities, valid DEV configuration and deliberate non-production test data |
| DEV-to-source migration checksum / clean database install | **NOT VERIFIED**; requires reconciliation and disposable DB rehearsal |

No app route was invoked with a write request; no demos, messages, students or payments were created. Production data was not modified.

## 7. Phase A entry backlog (priority order)

| ID | Priority | Required decision or deliverable | Exit evidence |
| --- | --- | --- | --- |
| A-01 | P0 | Reconcile migration ledger against DEV object definitions for files 40–47 and other manually applied changes | Versioned inventory, checksum/diff and reviewed installation order |
| A-02 | P0 | Isolate Portal demo booking service from admin UI | Explicit service boundary and command/state diagrams |
| A-03 | P0 | Define trainer availability/eligibility and atomic booking semantics | Conflict/race/no-show acceptance scenarios and service contract |
| A-04 | P0 | Define per-institute installation, narrow auth scopes and secure external linkage | Authorization matrix + cross-tenant negative tests |
| A-05 | P0 | Define idempotent booking/Zoom saga and event delivery with replay/reconcile | OpenAPI/Event schemas, retry tests and dead-letter policy |
| A-06 | P0 | Audit exposed security-definer grants and private/public schema authorization | Approved risk register and mitigations |
| A-07 | P1 | Define contact/guardian/learner and demo participant mappings | Verified link rules, ambiguous-match/manual-review flow |
| A-08 | P1 | Define accepted offer -> onboarding -> enrolled -> CRM Won policy | Once-only conversion contract and payment condition |
| A-09 | P1 | Define CRM-only calendar fallback and Portal-only demo workflows | Both products operate independently |
| A-10 | P1 | Formalize curriculum/course version vs CRM product/offer mapping | Domain ownership and future compatibility decisions |
| A-11 | P1 | Prepare DEV authenticated UAT with all roles; Portal demo, Zoom, finance, onboarding regression | Recorded real HTTP/browser results using dummy data |
| A-12 | P1 | Plan independent Connect DEV/PROD data and auth separation | Tenant isolation/deployment design; no current cutover |

## 8. Gate 0 disposition

**Gate 0 audit work complete within read-only authority.** The previously inaccessible DEV project is now queryable, source builds, the current repository vs DEV objects were inspected, and the key integration risks are catalogued. Do **not** interpret this as authorization to implement or as proof that live workflows pass.

Next safe step: Phase A architecture contracts plus migration/security reconciliation, followed by controlled DEV UAT. Phase B coding should wait for A-01 through A-06 design/verification exits. Retain all existing Portal functionality; do not merge to main, deploy or change Production without explicit owner approval.
