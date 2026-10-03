import { test, expect } from '@playwright/test';
import { type QaRole } from './env';
import { authStatePath } from './auth-state';

const cases: Array<[QaRole,string]> = [
  ['trainer','/admin'],
  ['parent','/admin'],
  ['student','/admin'],
  ['parent','/trainer'],
  ['student','/trainer'],
  ['trainer','/parent'],
];

for (const [role, forbidden] of cases) {
  test(`${role} cannot remain on ${forbidden}`, async ({ browser }) => {
    const context = await browser.newContext({ storageState: authStatePath(role) });
    const page = await context.newPage();
    await page.goto(forbidden, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.pathname === '/', { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe('/');
    await context.close();
  });
}
