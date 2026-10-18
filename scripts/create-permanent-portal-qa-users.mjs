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
loadEnvFile(".env.portal-qa.local");

const url = process.env.PORTAL_QA_SUPABASE_URL;
const serviceRoleKey = process.env.PORTAL_QA_SUPABASE_SERVICE_ROLE_KEY;
if (!url) throw new Error("Missing PORTAL_QA_SUPABASE_URL in .env.portal-qa.local.");
if (!serviceRoleKey) throw new Error("Missing PORTAL_QA_SUPABASE_SERVICE_ROLE_KEY in .env.portal-qa.local.");

const permanentQaUsers = [
  ["admin",   process.env.PORTAL_QA_ADMIN_EMAIL   || "portal-qa-admin@robotronix.local",   process.env.PORTAL_QA_ADMIN_PASSWORD,   "QA Admin"],
  ["trainer", process.env.PORTAL_QA_TRAINER_EMAIL || "portal-qa-trainer@robotronix.local", process.env.PORTAL_QA_TRAINER_PASSWORD, "QA Trainer"],
  ["parent",  process.env.PORTAL_QA_PARENT_EMAIL  || "portal-qa-parent@robotronix.local",  process.env.PORTAL_QA_PARENT_PASSWORD,  "QA Parent"],
  ["student", process.env.PORTAL_QA_STUDENT_EMAIL || "portal-qa-student@robotronix.local", process.env.PORTAL_QA_STUDENT_PASSWORD, "QA Student"],
];

for (const [role, email, password] of permanentQaUsers) {
  if (!password) throw new Error(`Missing PORTAL_QA_${role.toUpperCase()}_PASSWORD in .env.portal-qa.local.`);
  if (password.length < 8) throw new Error(`Permanent production QA ${role} password must be at least 8 characters.`);
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
  console.log("Creating/verifying permanent Robotronix production QA Auth users...\n");

  for (const [role, email, password, fullName] of permanentQaUsers) {
    const found = existing.find(u => (u.email || "").toLowerCase() === email.toLowerCase());

    if (found) {
      if (found.user_metadata?.permanent_portal_qa_user !== true) {
        throw new Error(`Refusing to modify existing non-QA Auth identity: ${email}`);
      }
      const { error } = await supabase.auth.admin.updateUserById(found.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(found.user_metadata || {}), full_name: fullName, qa_user: true, permanent_portal_qa_user: true },
      });
      if (error) throw new Error(`Failed to update ${email}: ${error.message}`);
      console.log(`✓ ${role.padEnd(7)} ${email} (existing user updated)`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, qa_user: true, permanent_portal_qa_user: true },
      });
      if (error) throw new Error(`Failed to create ${email}: ${error.message}`);
      console.log(`✓ ${role.padEnd(7)} ${email} (${data.user.id})`);
    }
  }

  console.log("\nPermanent production QA Auth users ready.");
  console.log("Next: run database/02_sanity/01_PROD_PORTAL_QA_SEED.sql in the Supabase SQL Editor.");
}

main().catch(err => {
  console.error("\nPermanent production QA Auth user setup failed:");
  console.error(err?.message || err);
  process.exit(1);
});
