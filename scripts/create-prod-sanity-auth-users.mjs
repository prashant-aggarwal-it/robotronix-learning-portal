import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filename) {
  const fullPath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(fullPath)) return;
  for (const raw of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env.sanity.local");

const url = process.env.SANITY_SUPABASE_URL;
const serviceRoleKey = process.env.SANITY_SUPABASE_SERVICE_ROLE_KEY;
if (!url) throw new Error("Missing SANITY_SUPABASE_URL in .env.sanity.local.");
if (!serviceRoleKey) throw new Error("Missing SANITY_SUPABASE_SERVICE_ROLE_KEY in .env.sanity.local.");

const sanityUsers = [
  ["admin",   process.env.SANITY_ADMIN_EMAIL   || "prod-sanity-admin@robotronix.local",   process.env.SANITY_ADMIN_PASSWORD,   "QA Admin"],
  ["trainer", process.env.SANITY_TRAINER_EMAIL || "prod-sanity-trainer@robotronix.local", process.env.SANITY_TRAINER_PASSWORD, "QA Trainer"],
  ["parent",  process.env.SANITY_PARENT_EMAIL  || "prod-sanity-parent@robotronix.local",  process.env.SANITY_PARENT_PASSWORD,  "QA Parent"],
  ["student", process.env.SANITY_STUDENT_EMAIL || "prod-sanity-student@robotronix.local", process.env.SANITY_STUDENT_PASSWORD, "QA Student"],
];

for (const [role, email, password] of sanityUsers) {
  if (!password) throw new Error(`Missing SANITY_${role.toUpperCase()}_PASSWORD in .env.sanity.local.`);
  if (password.length < 8) throw new Error(`Production sanity ${role} password must be at least 8 characters.`);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < 1000) break;
  }
  return users;
}

async function main() {
  const existing = await listAllUsers();
  console.log("Creating/verifying temporary Robotronix production-sanity Auth users...\n");

  for (const [role, email, password, fullName] of sanityUsers) {
    const found = existing.find(u => (u.email || "").toLowerCase() === email.toLowerCase());

    if (found) {
      const { error } = await supabase.auth.admin.updateUserById(found.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(found.user_metadata || {}), full_name: fullName, qa_user: true, production_sanity_user: true },
      });
      if (error) throw new Error(`Failed to update ${email}: ${error.message}`);
      console.log(`✓ ${role.padEnd(7)} ${email} (existing user updated)`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, qa_user: true, production_sanity_user: true },
      });
      if (error) throw new Error(`Failed to create ${email}: ${error.message}`);
      console.log(`✓ ${role.padEnd(7)} ${email} (${data.user.id})`);
    }
  }

  console.log("\nProduction-sanity Auth users ready.");
  console.log("Next: run database/02_sanity/01_PROD_SANITY_SEED.sql in the Supabase SQL Editor.");
}

main().catch(err => {
  console.error("\nProduction-sanity Auth user setup failed:");
  console.error(err?.message || err);
  process.exit(1);
});
