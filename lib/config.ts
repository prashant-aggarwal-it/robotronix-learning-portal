export const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const publicSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
export const isProduction = process.env.NEXT_PUBLIC_APP_ENV === "production";
export const productionConfigurationError = isProduction && !hasSupabaseEnv;

// Demo mode is intentionally allowed only outside production. RootLayout blocks a
// production deployment with missing Supabase browser configuration before the app renders.
export const appMode = hasSupabaseEnv ? "live" : "demo";
