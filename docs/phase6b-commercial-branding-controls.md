# Phase 6B — Commercial branding controls

Applies on top of Phase 6A. The canonical migration is `database/saas/77_phase6b_branding_write_entitlement_gate.sql`, **already applied to DEV** and safe to rerun. It extends the existing Phase 5 service-only RPC, not the database schema.

`standard` Owners may read their saved branding, but cannot save or upload new branding. Owners on `custom` or `white_label` may edit. Active Platform Super Admins retain the same authorized academy configuration privileges they had in Phase 5. All changes verify Academy module enablement, active organization and ownership.

The protected POST and upload endpoints use `authorizeBrandingWrite` which calls the database permission function. The database `saas_branding_save_v1` also gates writes, so direct RPC bypass is denied. The same GET returns `canEdit` for presentation; it is not trusted for authorization. Any pending in-browser edits become invalid when an entitlement is downgraded.

The tier change API from Phase 6A preserves `organization_settings` values. Reactivation of a saved `custom` or `white_label` tier reuses them; effective theme rendering for Standard is the separate Phase 6C task.

Run `node --test scripts/test-phase6b-branding.mjs`, previous Phase 5 and 6A regression tests, TypeScript and production build before acceptance.
