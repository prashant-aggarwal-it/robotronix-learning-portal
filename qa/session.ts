import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { authConfig, qaCredentials, type QaRole } from './env';


/**
 * Installs the Supabase session BEFORE the Robotronix app JavaScript starts.
 *
 * Important:
 * Writing localStorage after /login has already mounted can leave the singleton
 * Supabase browser client in a signed-out state for that document. addInitScript
 * avoids that race by placing the session into localStorage before every app
 * document is created.
 */
export async function ensureRoleSession(page: Page, role: QaRole) {
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
      data: { email, password },
    },
  );

  const raw = await tokenResponse.text();

  if (!tokenResponse.ok()) {
    throw new Error(
      `QA ${role} authentication failed for ${email}: HTTP ${tokenResponse.status()} ${raw}`,
    );
  }

  let session: any;

  try {
    session = JSON.parse(raw);
  } catch {
    throw new Error(
      `QA ${role} authentication returned non-JSON data.`,
    );
  }

  if (
    !session?.access_token ||
    !session?.refresh_token ||
    !session?.user?.id
  ) {
    throw new Error(
      `QA ${role} authentication did not return a complete Supabase session.`,
    );
  }

  // Verify the public profile with exactly this access token first.
  const profileResponse = await page.request.get(
    `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=id,role,active`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        Accept: 'application/json',
      },
    },
  );

  const profileRaw = await profileResponse.text();

  if (!profileResponse.ok()) {
    throw new Error(
      `QA ${role} profile lookup failed for ${email}: HTTP ${profileResponse.status()} ${profileRaw}`,
    );
  }

  let profiles: any[] = [];

  try {
    profiles = JSON.parse(profileRaw);
  } catch {
    throw new Error(
      `QA ${role} profile lookup returned non-JSON data.`,
    );
  }

  const profile = profiles[0];

  if (!profile) {
    throw new Error(
      `QA ${role} profile is not visible for ${email} (${session.user.id}).`,
    );
  }

  if (
    profile.id !== session.user.id ||
    profile.role !== role ||
    profile.active !== true
  ) {
    throw new Error(
      `QA ${role} profile mismatch for ${email}: id=${profile.id}, role=${profile.role}, active=${profile.active}`,
    );
  }

  const persistedSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at:
      session.expires_at ||
      Math.floor(Date.now() / 1000) +
        Number(session.expires_in || 3600),
    token_type: session.token_type || 'bearer',
    user: session.user,
  };

  // Critical fix:
  // preload the session BEFORE any Robotronix page initializes supabase-js.
  await page.context().addInitScript(
    ({ key, value }) => {
      try {
        if (
          window.location.protocol === 'http:' ||
          window.location.protocol === 'https:'
        ) {
          window.localStorage.setItem(key, JSON.stringify(value));
        }
      } catch {
        // about:blank and non-web documents may not expose localStorage.
      }
    },
    { key: storageKey, value: persistedSession },
  );

  // Prove the real application sees the session before the actual test begins.
  const expectedPath = `/${role}`;

  await page.goto(expectedPath, {
    waitUntil: 'domcontentloaded',
  });

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
        message:
          `QA ${role} session was valid through Supabase REST, ` +
          `but the browser app did not remain inside ${expectedPath}. ` +
          `Current URL: ${page.url()}`,
      },
    )
    .toBe(true);

  // Ensure the Supabase storage entry really exists in the browser origin.
  const browserSessionPresent = await page.evaluate(
    key => Boolean(window.localStorage.getItem(key)),
    storageKey,
  );

  if (!browserSessionPresent) {
    throw new Error(
      `QA ${role} session was not persisted in browser localStorage (${storageKey}).`,
    );
  }
}

export async function newRoleContext(
  browser: Browser,
  role: QaRole,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await ensureRoleSession(page, role);

  return { context, page };
}
