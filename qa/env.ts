import fs from 'node:fs';
import path from 'node:path';

let loaded = false;

export function loadQaEnv() {
  if (loaded) return;
  loaded = true;
  const candidates = ['.env.local', '.env.qa.local'];
  for (const file of candidates) {
    const full = path.resolve(file);
    if (!fs.existsSync(full)) continue;
    for (const raw of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export type QaRole = 'admin' | 'trainer' | 'parent' | 'student';

export function qaCredentials(role: QaRole) {
  loadQaEnv();
  const prefix = `QA_${role.toUpperCase()}`;
  return {
    email: process.env[`${prefix}_EMAIL`] ?? '',
    password: process.env[`${prefix}_PASSWORD`] ?? '',
  };
}

export function hasQaCredentials(role: QaRole) {
  const { email, password } = qaCredentials(role);
  return Boolean(email && password);
}

export function serviceConfig() {
  loadQaEnv();
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}
