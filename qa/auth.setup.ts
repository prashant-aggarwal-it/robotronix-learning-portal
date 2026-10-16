import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import {
  qaCredentials,
  authConfig,
  type QaRole,
} from './env';

test.setTimeout(75_000);

const roles: QaRole[] = ['admin', 'trainer', 'parent', 'student'];

const authDir = path.resolve('.qa-auth');
fs.mkdirSync(authDir, { recursive: true });

export function authStatePath(role: QaRole) {
  return path.join(authDir, `${role}.json`);
}


/**
 * Creates a QA session directly through Supabase Auth instead of typing into
 * the React login form.
 *
 * The actual login page should still be tested separately as a UI smoke test,
 * but reusable QA authentication should not depend on controlled-input timing.
 */
async function authenticate(page: Page, role: QaRole) {
  const { email, password } = qaCredentials(role);

  if (!email || !password) {
    throw new Error(
      `Missing QA/SANITY credentials for role ${role}.`,
    );
  }

  const { url, anonKey, storageKey } = authConfig();

  const tokenResponse = await page.request.post(
    `${url}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        email,
        password,
      },
    },
  );

  const raw = await tokenResponse.text();

  if (!tokenResponse.ok()) {
    let detail = raw;

    try {
      const parsed = JSON.parse(raw);
      detail =
        parsed?.msg ||
        parsed?.message ||
        parsed?.error_description ||
        parsed?.error ||
        raw;
    } catch {
      // Keep the raw response if it is not JSON.
    }

    throw new Error(
      `QA ${role} Supabase authentication failed for ${email}: HTTP ${tokenResponse.status()} ${detail}`,
    );
  }

  let session: any;

  try {
    session = JSON.parse(raw);
  } catch {
    throw new Error(
      `QA ${role} authentication returned a non-JSON response from Supabase.`,
    );
  }

  if (!session?.access_token || !session?.refresh_token || !session?.user?.id) {
    throw new Error(
      `QA ${role} authentication did not return a complete Supabase session.`,
    );
  }

  // Visit the app origin first so localStorage can be written for localhost.
  await page.goto('/login', {
    waitUntil: 'domcontentloaded',
  });

  const persistedSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at:
      session.expires_at ||
      Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600),
    token_type: session.token_type || 'bearer',
    user: session.user,
  };

  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: storageKey,
      value: persistedSession,
    },
  );

  const expectedPath = `/${role}`;

  await page.goto(expectedPath, {
    waitUntil: 'domcontentloaded',
  });

  await page.waitForLoadState('networkidle').catch(() => {
    // Next.js dev mode can keep connections open. URL verification below is
    // the authoritative check.
  });

  // Compatible with older Playwright versions:
  // poll a boolean and assert true instead of using toSatisfy().
  await expect
    .poll(
      () => {
        const pathname = new URL(page.url()).pathname;
        return (
          pathname === expectedPath ||
          pathname.startsWith(`${expectedPath}/`)
        );
      },
      {
        timeout: 15_000,
        message: `Expected QA ${role} to remain inside ${expectedPath}; current URL: ${page.url()}`,
      },
    )
    .toBe(true);

  await page.context().storageState({
    path: authStatePath(role),
  });
}

for (const role of roles) {
  test(`authenticate ${role}`, async ({ page }) => {
    await authenticate(page, role);
  });
}
