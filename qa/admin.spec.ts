import { expect, test } from '@playwright/test';
import { authStatePath } from './auth-state';
import { openAndCheck } from './helpers';

const routes = [
  '/admin', '/admin/onboarding', '/admin/students', '/admin/students/new',
  '/admin/trainers', '/admin/trainers/new', '/admin/courses', '/admin/courses/new',
  '/admin/enrollments', '/admin/schedule', '/admin/classes',
  '/admin/alerts', '/admin/audit', '/admin/finance', '/admin/trainer-finance',
  '/admin/progress', '/admin/progress/alerts', '/admin/progress/projects',
  '/admin/messages', '/admin/notifications', '/admin/reminders',
];

test.describe('Admin screen sweep', () => {
  test.use({ storageState: authStatePath('admin') });

  for (const route of routes) {
    test(`${route} renders cleanly`, async ({ page }) => openAndCheck(page, route));
  }

  test('/admin/batches legacy route redirects cleanly to /admin/enrollments', async ({ page }) => {
    const response = await page.goto('/admin/batches', { waitUntil: 'networkidle' });
    expect(response?.status() ?? 200).toBeLessThan(500);
    await expect(page).toHaveURL(/\/admin\/enrollments$/);
    await expect(page.locator('body')).not.toContainText('This page could not be found');
  });
});
