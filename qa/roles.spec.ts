import { expect, test } from '@playwright/test';
import { type QaRole } from './env';
import { authStatePath } from './auth-state';
import { openAndCheck } from './helpers';
import { QA_IDS, resetWorkflowEnrollment } from './qa-db';

const roleRoutes: Record<Exclude<QaRole,'admin'>, string[]> = {
  trainer: ['/trainer','/trainer/progress','/trainer/classes','/trainer/schedule','/trainer/courses','/trainer/earnings','/trainer/projects','/trainer/messages','/trainer/notifications'],
  parent: ['/parent','/parent/learner','/parent/messages','/parent/notifications'],
  student: ['/student','/student/course','/student/portfolio','/student/notifications'],
};

for (const [role, routes] of Object.entries(roleRoutes) as [Exclude<QaRole,'admin'>, string[]][]) {
  test.describe(`${role} screen sweep`, () => {
    test.use({ storageState: authStatePath(role) });
    for (const route of routes) {
      test(`${route} renders cleanly`, async ({ page }) => openAndCheck(page, route));
    }
  });
}


test.describe('Parent dynamic learner screen', () => {
  test.use({ storageState: authStatePath('parent') });

  test('/parent/learner/[studentId] renders linked QA learner', async ({ page }) => {
    // Make this role check independent of any state left by an earlier QA run.
    await resetWorkflowEnrollment();
    const response = await page.goto(`/parent/learner/${QA_IDS.student}`, { waitUntil: 'domcontentloaded' });
    expect(response?.status() ?? 200).toBeLessThan(500);
    await expect(page.locator('.experienceLoading')).toBeHidden({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'QA Robotics Foundations' })).toBeVisible({ timeout: 15_000 });
  });
});
