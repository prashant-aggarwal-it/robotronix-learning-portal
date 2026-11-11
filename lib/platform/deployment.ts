/**
 * Deployment capabilities describe what software modules are intentionally installed.
 * They are NOT end-user permissions, subscriptions, or proof that database schemas exist.
 * Phase 3/4 must separately authenticate/authorize each business API.
 */
export const PRODUCT_IDS = ["portal", "crm", "tasks"] as const;
export const INTEGRATION_IDS = ["crmPortal", "crmTasks", "portalTasks"] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];
export type IntegrationId = (typeof INTEGRATION_IDS)[number];
export type ProductMode = ProductId | "combined";
export type DeploymentEnv = Record<string, string | undefined>;
export type DeploymentConfig = Readonly<{
  mode: ProductMode;
  products: readonly ProductId[];
  integrations: readonly IntegrationId[];
  legacyDefault: boolean;
}>;

const required: Record<IntegrationId, readonly ProductId[]> = {
  crmPortal: ["crm", "portal"],
  crmTasks: ["crm", "tasks"],
  portalTasks: ["portal", "tasks"],
};
const isProduct = (value: string): value is ProductId =>
  (PRODUCT_IDS as readonly string[]).includes(value);
const isIntegration = (value: string): value is IntegrationId =>
  (INTEGRATION_IDS as readonly string[]).includes(value);

function parseCsv(value: string, field: string): string[] {
  const tokens = value.split(",").map(item => item.trim());
  if (tokens.some(item => !item)) throw new Error(field + " contains an empty entry.");
  if (new Set(tokens).size !== tokens.length) throw new Error(field + " contains duplicate entries.");
  return tokens;
}

/** A missing PRODUCT_MODE retains the existing combined application's behavior.
 * Explicit modes are opt-in; integrations are never implicitly enabled in explicit mode.
 */
export function resolveDeploymentConfig(env: DeploymentEnv): DeploymentConfig {
  const rawMode = env.PRODUCT_MODE?.trim();
  const legacyDefault = !rawMode;
  const mode = rawMode || "combined";
  if (mode !== "portal" && mode !== "crm" && mode !== "tasks" && mode !== "combined") {
    throw new Error("PRODUCT_MODE must be portal, crm, tasks or combined.");
  }

  const selected = env.ENABLED_PRODUCTS?.trim();
  if (env.ENABLED_PRODUCTS !== undefined && !selected) throw new Error("ENABLED_PRODUCTS cannot be empty.");
  const productTokens = selected ? parseCsv(selected, "ENABLED_PRODUCTS") :
    mode === "combined" ? [...PRODUCT_IDS] : [mode];
  if (productTokens.some(item => !isProduct(item))) {
    throw new Error("ENABLED_PRODUCTS contains an unknown product.");
  }
  if (mode !== "combined" && (productTokens.length !== 1 || productTokens[0] !== mode)) {
    throw new Error("Standalone PRODUCT_MODE must enable only its own product.");
  }
  const products = productTokens as ProductId[];
  if (!products.length) throw new Error("At least one product must be enabled.");

  const selectedIntegrations = env.ENABLED_INTEGRATIONS?.trim();
  if (env.ENABLED_INTEGRATIONS !== undefined && !selectedIntegrations) throw new Error("ENABLED_INTEGRATIONS cannot be empty.");
  // Legacy unconfigured combined installs continue to expose existing integration routes.
  // New explicit deployments must opt into each installed integration.
  const integrationTokens = selectedIntegrations ?
    parseCsv(selectedIntegrations, "ENABLED_INTEGRATIONS") :
    legacyDefault ? [...INTEGRATION_IDS] : [];
  if (integrationTokens.some(item => !isIntegration(item))) {
    throw new Error("ENABLED_INTEGRATIONS contains an unknown integration.");
  }
  const integrations = integrationTokens as IntegrationId[];
  for (const id of integrations) {
    if (required[id].some(product => !products.includes(product))) {
      throw new Error(id + " requires " + required[id].join(" and ") + ".");
    }
  }
  return { mode, products, integrations, legacyDefault };
}
export function hasProduct(config: DeploymentConfig, id: ProductId): boolean {
  return config.products.includes(id);
}
export function hasIntegration(config: DeploymentConfig, id: IntegrationId): boolean {
  return config.integrations.includes(id);
}

export type RouteRequirement = ProductId | IntegrationId | "taskIntegrations" | "shared";
/** Route availability is deployment-scoped and never substitutes for user authorization. */
export function routeRequirement(pathname: string): RouteRequirement {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/" || p === "/login" || p === "/auth/callback" || p === "/join" ||
      p === "/privacy" || p === "/terms" || p === "/support" ||
      p === "/api/health" || p.startsWith("/api/locations/") ||
      p === "/api/platform/capabilities" || p === "/api/platform/my-products") return "shared";

  // Module links are checked per requested source by their API handler.
  // A Portal+Tasks deployment must not require CRM merely to reach the API.
  if (p === "/api/tasks/module-links" || p === "/tasks/connected" ||
      p === "/tasks/v2/connected") return "taskIntegrations";

  if (p.startsWith("/api/connect/")) {
    // The legacy combined reminder route calls CRM and Portal RPCs.
    if (p === "/api/connect/jobs/reminders") return "crmPortal";
    if (/^\/api\/connect\/workspaces\/[^/]+\/(?:admissions|lifecycle|portal-demos|portal-integration)(?:\/|$)/.test(p)) {
      return "crmPortal";
    }
    return "crm";
  }
  if (p === "/connect" || p.startsWith("/connect/")) return "crm";
  if (p === "/tasks" || p.startsWith("/tasks/") ||
      p === "/api/tasks" || p.startsWith("/api/tasks/")) return "tasks";

  if (p.startsWith("/api/admission/handoff/")) return "crmPortal";
  if (p.startsWith("/api/")) return "portal";
  // All other application pages belong to the Learning Portal until Phase 5
  // extracts product-specific landing, login and navigation shells.
  return "portal";
}
export function isRouteAvailable(config: DeploymentConfig, pathname: string): boolean {
  const requiredId = routeRequirement(pathname);
  if (requiredId === "taskIntegrations") return hasProduct(config,"tasks") &&
    (hasIntegration(config,"crmTasks") || hasIntegration(config,"portalTasks"));
  return requiredId === "shared" || (
    requiredId === "portal" || requiredId === "crm" || requiredId === "tasks" ?
      hasProduct(config, requiredId) : hasIntegration(config, requiredId)
  );
}
export function defaultProductPath(config: DeploymentConfig): string {
  if (hasProduct(config, "portal")) return "/";
  if (hasProduct(config, "crm")) return "/connect";
  return "/tasks";
}
