import { expect, Page } from '@playwright/test';
import { qaCredentials, type QaRole } from './env';

const ignoredConsolePatterns = [
  /Download the React DevTools/i,
  /favicon/i,
];

export function watchRuntime(page: Page) {
  const errors: string[] = [];

  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!ignoredConsolePatterns.some(pattern => pattern.test(text))) {
      errors.push(`console.error: ${text}`);
    }
  });
  page.on('response', response => {
    if (response.status() >= 500) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  return errors;
}

export async function assertHealthyScreen(page: Page, expectedPath?: string) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(900);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.locator('body')).not.toContainText('Internal Server Error');
  await expect(page.locator('body')).not.toContainText('This page could not be found');
  await expect(page.locator('body')).not.toContainText('Checking your Robotronix™ account…', { timeout: 6_000 });
  if (expectedPath) expect(new URL(page.url()).pathname).toBe(expectedPath);
}

export async function openAndCheck(page: Page, path: string) {
  const runtimeErrors = watchRuntime(page);
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.status() ?? 200, `Navigation response for ${path}`).toBeLessThan(500);
  await assertHealthyScreen(page, path);
  expect(runtimeErrors, `Runtime errors on ${path}`).toEqual([]);
}

export async function loginAsRole(page: Page, role: QaRole) {
  const { email, password } = qaCredentials(role);
  if (!email || !password) throw new Error(`Missing QA_${role.toUpperCase()}_EMAIL / QA_${role.toUpperCase()}_PASSWORD in .env.local`);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const panel = page.locator('.accessPanel');
  const emailInput = panel.locator('input[type="email"]');
  const passwordInput = panel.locator('input[type="password"]');
  const errorBanner = panel.locator('.errorBanner');
  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await panel.getByRole('button', { name: /^Sign in$/ }).click();

  const expected = `/${role}`;
  const outcome = await Promise.race([
    page.waitForURL(url => url.pathname === expected || url.pathname.startsWith(`${expected}/`), { timeout: 15_000 }).then(() => ({ ok: true as const })),
    errorBanner.waitFor({ state: 'visible', timeout: 15_000 }).then(async () => ({ ok: false as const, message: (await errorBanner.textContent())?.trim() || 'Unknown sign-in error' })),
  ]).catch(() => ({ ok: false as const, message: `Timed out waiting for ${expected}` }));

  if (!outcome.ok) throw new Error(`QA ${role} sign-in failed for ${email}: ${outcome.message}`);
  await assertHealthyScreen(page);
}

export function formGroup(page: Page, label: string) {
  return page.locator('.formGroup').filter({ has: page.locator('label', { hasText: label }) }).first();
}
