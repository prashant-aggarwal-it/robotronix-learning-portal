# Robotronix Connect — documentation index

**Current decisions:** [SAAS_ARCHITECTURE_DECISION.md](SAAS_ARCHITECTURE_DECISION.md), [CANONICAL_DATA_MODEL.md](CANONICAL_DATA_MODEL.md), [ROBOTRONIX_PRODUCTION_GO_LIVE_GATE.md](ROBOTRONIX_PRODUCTION_GO_LIVE_GATE.md).

**Database operations:** [database/connect/README.md](../../database/connect/README.md). SQL verification scripts now live in `database/connect/tests/`; only schema/source and historical applied SQL remain in `database/connect/saas/`.

**Historical implementation reports:** `PHASE1_EXECUTION_REPORT.md`, `PHASE2A_WORKSPACE_SECURITY.md`, `PHASE2B_CRM_BACKEND.md`, `PHASE2C_UI_EXECUTION_REPORT.md`, `PHASE2D_QA_EXECUTION_LOG.md`, and `PHASE3A`–`PHASE3D` reports. They describe completed development phases, not necessarily the current deployment state.

**Superseded proposal:** `ARCHITECTURE_AUDIT.md` documents the abandoned Portal-coupled prototype. Keep it for decision history only; do not implement its schema or treat it as current architecture.

**Release policy:** do not merge to `main`, deploy, or modify Production without explicit user approval. Source cleanup does not constitute a successful build, browser UAT, or production readiness.

## Current code organization (after feature consolidation)

- `app/connect/page.tsx` — Connect orchestration and feature-screen rendering (still relatively large; future screen-by-screen extraction should be regression-tested).
- `app/connect/layout.tsx` + `connect.css` — Connect route metadata and scoped theme.
- `features/connect/ConnectSidebar.tsx`, `ConnectTopbar.tsx`, `ConnectAuthGates.tsx` — product shell and entry flows.
- `components/ApplicationSwitcher.tsx` — one shared Portal / Connect application switcher, rendered only in allowed contexts.
- `features/connect/model.ts`, `EmptyStates.tsx` — navigation, basic formatting, category suggestions, feedback UI.
- `features/connect/components/` — CRM settings, communications, reports and channel UI.
- `features/connect/api/client.ts` — browser API client, data contracts and commands.
- `lib/connect-client.ts` — compatibility re-export, retained temporarily for existing imports; it contains no duplicate implementation.
- `lib/server/connect-auth.ts`, `connect-ingestion.ts` — server-only authentication and signed provider ingestion.
- `app/api/connect/` — independent authenticated HTTP routes.

**Validation:** CI is configured for typecheck, build, existing structural checks, database directory guard, and feature import guard. This document does not claim those CI jobs or authenticated browser regression have passed. Do not merge until actual CI logs and Portal + Connect QA are reviewed.

**Scope:** Shared Portal CSS and legacy Portal internals are intentionally not mass-moved in this pass: their dependencies require a verified full Portal build/regression suite. Avoid deleting historical SQL, applied migrations or unverified legacy Portal files simply for tidiness.
