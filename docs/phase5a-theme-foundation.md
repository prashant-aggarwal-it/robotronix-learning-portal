# Phase 5A — Centralized theme foundation

**Baseline:** `feature/education-suite-phase4d` at `9f530a01b23f6e187432e5b2ea3dc6e55d518eb9`
**Working branch:** `feature/education-suite-phase5a-theme-foundation`
**Safety:** No database modifications, production writes, merges, or Netlify deployments.

## Audit
The existing app has many legacy CSS declarations: `app/globals.css` (~260 KB), `app/connect/connect.css` (~145 KB), Tasks v2 styles and Platform Admin styles. Classic and AI Flow are managed by `components/ThemeSwitcher.tsx` and `app/theme.css`. They must remain functional. Major literal colors remain in component CSS; replacing all colors would risk unintended changes, so this stage uses incremental semantic mappings.

## Canonical tokens and layering
`app/design-tokens.css` is imported first in `app/layout.tsx`, before global and legacy theme styles. It owns the semantic tokens for brand, backgrounds, text, navigation, controls and semantic states. `lib/theme/tokens.ts` defines a typed `TenantTheme`, the Robotronix defaults, strict hex color parsing, color contrast, fallback resolution and a safe CSS-variable mapping.

Legacy `--ink`, `--purple`, `--muted`, `--line` and related Academy values now reference semantic tokens. `app/suite-shell.css`, `app/ui-foundations.css` and Platform Admin have targeted semantic integrations. CRM and Tasks retain their respective original product-specific palette defaults via `--product-primary` and `--product-accent` compatibility variables. We do not replace their distinctive blue/teal baselines with the purple Robotronix default.

**Theme order:** (1) safety and semantic state colors; (2) future approved tenant brand tokens at authenticated workspace scope; (3) existing Classic / AI Flow presentation overrides where supported; (4) Robotronix defaults. Classic/AI Flow remain unmodified; future Phase 5C needs explicit conflict handling before allowing scoped tenant themes. Platform Admin remains corporate-brand controlled with `--platform-brand-primary`, outside the tenant branding scope.

## Accessibility and security
Only `#RGB` and `#RRGGBB` are accepted by `normalizeHexColor`. `themeToCssVariables` maps a fixed token allowlist and never injects raw CSS text. `resolveTenantTheme` preserves defaults for invalid partial inputs, and corrects unreadable primary-button foreground combinations. Semantic success/warning/error/info colors are independent of tenant brand colors.

## Integrations
- Academy: existing core globals mapped to semantic colors; shared UI foundation uses semantic state and border tokens.
- Suite: form focus, border and error states use semantic tokens.
- CRM: primary semantic compatibility bindings for CRM state and accent values.
- Tasks: v2 and product-experience primary/accent mapping to local semantic tokens.
- Platform Admin: navigation background, border, active/primary accents and card defaults linked to semantic values.

## Verification
`npm run test:theme-foundation` covers token exports, 3/6-digit parsing, invalid CSS injection, contrast ratios, fallbacks, mapping and CSS contract. The Phase 5A branch runs this along with the existing `qa-branch-static` suite (typography, typecheck, Academy billing, auth callback, database contracts, CRM, Tasks and security source tests). GitHub Actions result must be checked before certification.

**Visual qualification:** No pixel-diff screenshots or authenticated visual/browser E2E were performed in this phase. Exact visual parity is therefore not certified.

## Known gaps and follow-ups
This is **the foundation, not full app-wide no-hardcoding completion**. Legacy styles still have many hardcoded contextual and branding colors; not every button/card/navigation selector uses semantic tokens. Additional style migration and representative screenshot regression verification are required before claiming 100% token adoption. CRM/Tasks have distinct default themes today by design.

**Phase 5B:** Logo upload or validated remote URL, pixel extraction, palette suggestions, contrast-aware generation, manual correction and live preview. Restrict external image fetching and verify MIME, size, image format and access as appropriate.

**Phase 5C:** Authenticated tenant theme fetch/cache; organization switch lifecycle, safe scoped CSS variables, consistent tenant logo/name in Academy, CRM, Tasks and Suite; prevent tenant theme bleed and retain platform-admin corporate identity. Include tenancy isolation tests and visual regression coverage.

## Phase 5A completion pass

A focused second pass moved CRM focus rings and sidebar surfaces, Tasks sidebar surfaces and active-navigation colors, and Platform Admin form focus rings, action gradients and controls into named semantic compatibility tokens. The literal fallback paint values were retained where applicable, avoiding an intended redesign.

The automated source tests cover these bindings and baseline paint tokens. Existing sprawling layout-specific stylesheet values remain intentionally intact because they do not all represent tenant-adjustable brand identity. Full static elimination of every literal CSS color would also remove semantic data visualization and status distinctions; Phase 5C should only theme the approved brand-sensitive subset.

**Final visual certification limitation:** The repository CI checks source contracts, tests and compilation, but it does not include an authenticated screenshot comparison across every Academy role, CRM, Tasks and the Platform Admin. Do not claim that all visual changes have been inspected. Before production rollout, obtain signed-off screenshots for those views, including Classic/AI Flow.
