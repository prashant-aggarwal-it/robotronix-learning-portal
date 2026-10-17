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
if (!url || !serviceRoleKey) throw new Error("Missing SANITY_SUPABASE_URL/SANITY_SUPABASE_SERVICE_ROLE_KEY in .env.sanity.local.");

const emails = [
  process.env.SANITY_ADMIN_EMAIL || "prod-sanity-admin@robotronix.local",
  process.env.SANITY_TRAINER_EMAIL || "prod-sanity-trainer@robotronix.local",
  process.env.SANITY_PARENT_EMAIL || "prod-sanity-parent@robotronix.local",
  process.env.SANITY_STUDENT_EMAIL || "prod-sanity-student@robotronix.local",
].map(x => x.toLowerCase());

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function allUsers() {
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
  console.log("Deleting Robotronix Production-sanity Auth users...");
  const users = await allUsers();

  for (const email of emails) {
    const user = users.find(u => (u.email || "").toLowerCase() === email);
    if (!user) {
      console.log(`- ${email}: not found`);
      continue;
    }
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Failed to delete ${email}: ${error.message}`);
    console.log(`✓ ${email}: deleted`);
  }
  console.log("\nProduction-sanity Auth users removed.");
}

main().catch(err => {
  console.error("\nProduction-sanity Auth cleanup failed:");
  console.error(err?.message || err);
  process.exit(1);
});
