const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missing = required.filter((key) => !process.env[key]?.trim());
const errors = [];
if (process.env.NEXT_PUBLIC_APP_ENV !== "production") errors.push("NEXT_PUBLIC_APP_ENV must equal production.");
if (missing.length) errors.push(`Missing: ${missing.join(", ")}`);
if (process.env.NEXT_PUBLIC_SITE_URL && !/^https:\/\//i.test(process.env.NEXT_PUBLIC_SITE_URL)) errors.push("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== process.env.SUPABASE_URL) errors.push("Public and server Supabase URLs must point to the same production project.");
if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) errors.push("Service-role key must never equal/expose the public anon key.");

if (errors.length) {
  console.error("Production environment check failed:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log("Production environment check passed.");
