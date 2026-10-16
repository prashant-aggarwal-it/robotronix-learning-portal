import { test, expect } from '@playwright/test';
import { watchRuntime } from './helpers';

test('landing page loads without runtime errors', async ({ page }) => {
  const errors = watchRuntime(page);
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await expect(page.getByRole('link', { name: /Start family onboarding/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Existing user\? Sign in/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /See the learning/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test('new-family onboarding opens', async ({ page }) => {
  const errors = watchRuntime(page);
  const response = await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await expect(page.locator('body')).not.toContainText('Application error');
  expect(errors).toEqual([]);
});
