import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filename = ".env.local") {
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
loadEnvFile();

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Missing Supabase URL/service-role key in .env.local.");

const emails = [
  process.env.QA_ADMIN_EMAIL || "qa-admin@robotronix.local",
  process.env.QA_TRAINER_EMAIL || "qa-trainer@robotronix.local",
  process.env.QA_PARENT_EMAIL || "qa-parent@robotronix.local",
  process.env.QA_STUDENT_EMAIL || "qa-student@robotronix.local",
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
  console.log("Deleting Robotronix QA Auth users...");
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
  console.log("\nQA Auth users removed.");
}

main().catch(err => {
  console.error("\nQA Auth cleanup failed:");
  console.error(err?.message || err);
  process.exit(1);
});
