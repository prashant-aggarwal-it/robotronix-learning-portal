import type { NextConfig } from "next";

const supabaseOrigin = (() => {
  try { return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : ""; }
  catch { return ""; }
})();

// Zoom Meeting SDK requires WebAssembly/worker/media access and Zoom-hosted assets.
// Keep the allow-list explicit rather than opening the portal to arbitrary origins.
const connectSources = [
  "'self'",
  supabaseOrigin,
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://zoom.us",
  "https://*.zoom.us",
  "wss://*.zoom.us",
  "https://zoom.com",
  "https://*.zoom.com",
  "wss://*.zoom.com",
  "https://zoom.com.cn",
  "https://*.zoom.com.cn",
  "wss://*.zoom.com.cn",
].filter(Boolean).join(" ");

const zoomScriptSources = "https://zoom.us https://*.zoom.us https://source.zoom.us https://dmogdx0jrul3u.cloudfront.net blob:";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https://source.zoom.us https://*.zoom.us",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${zoomScriptSources}`,
  "worker-src 'self' blob:",
  `connect-src ${connectSources}`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // The Zoom classroom is a same-origin iframe. Camera/mic/display capture stay limited to this origin.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
