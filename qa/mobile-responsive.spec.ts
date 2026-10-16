import { expect, test } from '@playwright/test';
import { authStatePath } from './auth-state';

const roleRoutes = {
  admin: ['/admin','/admin/onboarding','/admin/students','/admin/schedule','/admin/finance'],
  trainer: ['/trainer','/trainer/progress','/trainer/classes','/trainer/schedule','/trainer/earnings'],
  parent: ['/parent','/parent/learner','/parent/messages','/parent/notifications'],
  student: ['/student','/student/course','/student/portfolio','/student/notifications'],
} as const;

for (const [role, routes] of Object.entries(roleRoutes)) {
  test.describe(`${role} mobile responsive smoke`, () => {
    test.use({ storageState: authStatePath(role as keyof typeof roleRoutes) });
    for (const route of routes) {
      test(`${route} has no page-level horizontal overflow`, async ({ page }) => {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response?.status() ?? 200).toBeLessThan(500);
        await page.waitForTimeout(300);
        const dims = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(dims.scrollWidth, `Horizontal overflow on ${route}: ${dims.scrollWidth}px > ${dims.clientWidth}px`).toBeLessThanOrEqual(dims.clientWidth + 2);
      });
    }
  });
}
