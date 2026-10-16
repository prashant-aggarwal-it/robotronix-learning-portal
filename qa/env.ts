import fs from 'node:fs';
import path from 'node:path';

let loaded = false;

export function loadQaEnv() {
  if (loaded) return;
  loaded = true;
  const candidates = ['.env.local', '.env.qa.local', '.env.sanity.local'];
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export type QaRole = 'admin' | 'trainer' | 'parent' | 'student';

export function isProductionSanity() {
  loadQaEnv();
  return process.env.QA_TARGET === 'production';
}

export function qaCredentials(role: QaRole) {
  loadQaEnv();
  const qaPrefix = `QA_${role.toUpperCase()}`;
  const sanityPrefix = `SANITY_${role.toUpperCase()}`;
  const sanity = isProductionSanity();
  return {
    email: sanity ? (process.env[`${sanityPrefix}_EMAIL`] || '') : (process.env[`${qaPrefix}_EMAIL`] || process.env[`${sanityPrefix}_EMAIL`] || ''),
    password: sanity ? (process.env[`${sanityPrefix}_PASSWORD`] || '') : (process.env[`${qaPrefix}_PASSWORD`] || process.env[`${sanityPrefix}_PASSWORD`] || ''),
  };
}

export function hasQaCredentials(role: QaRole) {
  const { email, password } = qaCredentials(role);
  return Boolean(email && password);
}

export function serviceConfig() {
  loadQaEnv();
  if (isProductionSanity()) {
    return {
      url: process.env.SANITY_SUPABASE_URL || '',
      anonKey: process.env.SANITY_SUPABASE_ANON_KEY || '',
      serviceRoleKey: process.env.SANITY_SUPABASE_SERVICE_ROLE_KEY || '',
    };
  }
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

export function authConfig() {
  const { url, anonKey } = serviceConfig();
  if (!url) throw new Error('Missing Supabase URL for QA/sanity authentication.');
  if (!anonKey) throw new Error('Missing Supabase anon key for QA/sanity authentication.');
  const cleanUrl=url.replace(/\/$/,'');
  const projectRef = new URL(cleanUrl).hostname.split('.')[0];
  if (!projectRef) throw new Error(`Unable to derive Supabase project ref from ${cleanUrl}`);
  return { url: cleanUrl, anonKey, storageKey: `sb-${projectRef}-auth-token` };
}
