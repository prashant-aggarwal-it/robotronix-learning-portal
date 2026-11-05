# Robotronix Connect — Revised Phase 1 Execution Report (2026-11-05)

**Canonical design:** [SAAS_ARCHITECTURE_DECISION.md](SAAS_ARCHITECTURE_DECISION.md)
**Branch:** feature/robotronix-connect-crm
**Environment changed:** Supabase Development fflejkqcspivnhsmkdtn only
**Unchanged:** Production database, main Git branch, 80 existing Learning Portal tables and application code

## Installed in Development
- Migration `connect_saas_v2_independent_foundation_20261105`: created independent `connect.*` SaaS schema.
- Migration `retire_empty_crm_prototype_20261105`: after checking all 28 prior prototype tables had zero rows, dropped them using RESTRICT in a transaction, with no CASCADE.
- Migration `connect_saas_v2_canonical_hardening_20261105`: introduced multiple person roles, removed redundant opportunity state, strengthened stage-history pipeline foreign keys.

### Verified current database
- **35** standalone Connect tables; all have RLS enabled.
- **0** foreign keys from Connect into any Learning Portal public table.
- **0** leftover `public.crm_*` prototype tables.
- **80** pre-existing public Learning Portal tables preserved.
- No direct `anon` or `authenticated` database access to Connect schema; no tenant members can read CRM yet, by design.
- Transactional smoke tests: two-tenant cross-tenant person relation rejected, invalid pipeline stage rejected, guardian+customer multi-role permitted, stage history from a different pipeline rejected, correctly scoped event permitted. QA transactions rolled back.

## Canonical deployment source
- `database/connect/saas/01_connect_independent_schema.sql`: standalone fresh-install DDL, independent of Portal.
- `database/connect/saas/02_retire_empty_prototype_dev_only.sql`: historical Dev-only cleanup, **never run on independent Connect installs or production**.
- `database/connect/saas/03_harden_canonical_model_dev.sql`: historical Dev-only refinement (already folded into canonical fresh source).
- `database/connect/tests/verify_foundation.sql`: read-only verification.
- The former `database/01_install/modules/schema/12_connect_crm.sql` has been deleted, so Portal's generated installer no longer adds Connect.
- Earlier Portal-coupled CRM design docs are marked historical/superseded.

## Not yet implemented / not certified
- Independent deployed Connect Supabase project/app, product Auth workspace onboarding, secure user authorization/RLS membership rules and tenant staff invitations.
- Full server APIs and RBAC tests; direct browser access intentionally denied until authorized endpoints exist.
- Production-grade webhook signature verification, privacy controls, consent enforcement, events and audit immutability.
- Fresh-install execution in a separate empty database and full Learning Portal Playwright regression tests. These must pass before release.
- Portal integration adapter and standalone SaaS UI.
- SaaS billing checkout/invoice integration, pricing configuration and subscription enforcement.

**Phase 1 redesign is installed and verified for its database invariants. Its release gate remains open pending independent-install and application/authorization tests. No merge/deployment approval requested.**
