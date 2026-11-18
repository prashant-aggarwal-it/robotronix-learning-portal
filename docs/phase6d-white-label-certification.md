# Phase 6D — White-label identity and DEV certification

## Implementation
Optional vendor attribution is determined solely by `showVendorAttribution` in the central `lib/theme/tenant-runtime.ts`: only `white_label` suppresses it. `TenantVendorAttribution` uses the authorized effective theme from `TenantBrandingProvider`, with no client-controlled entitlement override. Standard and Custom retain `Powered by Robotronix`; Platform Admin remains Robotronix-branded.

Supported surfaces: Suite Home, the shared Academy Admin/Trainer/Parent/Student AppShell, Connect CRM sidebar, and linked Tasks sidebar. Personal/unlinked Tasks retain default identity. This is **not** a complete custom-domain, tenant-specific OAuth, email sender, document/certificate, or mobile application white-label system. Login and globally unauthenticated entry points remain Robotronix by design until tenant identity can be securely established.

Legal notices, policy disclosures, internal identifiers and security UI are not suppressed. CRM/Tasks application membership, mappings, and tenant-level entitlements remain separate from presentation controls.

## Verification
The Phase 6C provider and `/api/tenant-branding` enforce module links and tier resolution; this phase does not add tables or migrations. Automated acceptance runs Phase 5A/B/C, 6A/B/C, 6D, browser Suite/CRM/Tasks and Phase 6B UI scenarios.

The DEV SQL rollback tests can verify two organizations' saved branding, tier transitions, cross-tenant database reads and unchanged stored settings. **They are not real authenticated HTTP tests.** Real DEV HTTP token-backed acceptance and role-by-role live Academy acceptance must be reported as pending unless executed with existing fixtures and an actual configured server. Do not call the complete system production certified based on browser mocks alone.

Custom-domain, branded login/OAuth and email/notification sender flows remain future Phase 6E work. No PROD, main or Netlify changes.
