import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { qaCredentials, type QaRole } from './env';

const roles: QaRole[] = ['admin', 'trainer', 'parent', 'student'];
const authDir = path.resolve('.qa-auth');
fs.mkdirSync(authDir, { recursive: true });

export function authStatePath(role: QaRole) {
  return path.join(authDir, `${role}.json`);
}

async function authenticate(page: import('@playwright/test').Page, role: QaRole) {
  const { email, password } = qaCredentials(role);
  if (!email || !password) {
    throw new Error(`Missing QA_${role.toUpperCase()}_EMAIL / QA_${role.toUpperCase()}_PASSWORD in .env.local`);
  }

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const panel = page.locator('.accessPanel');
  const emailInput = panel.locator('input[type="email"]');
  const passwordInput = panel.locator('input[type="password"]');
  const errorBanner = panel.locator('.errorBanner');
  const signInButton = panel.getByRole('button', { name: /^Sign in$/ });

  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  await expect(passwordInput).toBeVisible({ timeout: 10_000 });

  // React-controlled fields were intermittently losing values when Playwright used
  // fill() followed immediately by submit. Type like a real user and verify the
  // browser field values before submitting.
  await emailInput.click();
  await emailInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await emailInput.press('Backspace');
  await emailInput.pressSequentially(email, { delay: 8 });

  await passwordInput.click();
  await passwordInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await passwordInput.press('Backspace');
  await passwordInput.pressSequentially(password, { delay: 8 });

  await expect(emailInput).toHaveValue(email);
  await expect(passwordInput).toHaveValue(password);

  // Give React one micro-turn to commit controlled input state before submit.
  await page.waitForTimeout(100);
  await signInButton.click();

  const expected = `/${role}`;
  const outcome = await Promise.race([
    page.waitForURL(url => url.pathname === expected || url.pathname.startsWith(`${expected}/`), { timeout: 15_000 })
      .then(() => ({ ok: true as const })),
    errorBanner.waitFor({ state: 'visible', timeout: 15_000 })
      .then(async () => ({ ok: false as const, message: (await errorBanner.textContent())?.trim() || 'Unknown sign-in error' })),
  ]).catch(() => ({ ok: false as const, message: `Timed out waiting for ${expected}; current URL: ${page.url()}` }));

  if (!outcome.ok) {
    throw new Error(`QA ${role} sign-in failed for ${email}: ${outcome.message}`);
  }

  expect(new URL(page.url()).pathname.startsWith(expected)).toBe(true);
  await page.context().storageState({ path: authStatePath(role) });
}

for (const role of roles) {
  test(`authenticate ${role}`, async ({ page }) => {
    await authenticate(page, role);
  });
}
