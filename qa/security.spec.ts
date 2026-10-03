import { test, expect } from '@playwright/test';

const protectedRoutes = ['/admin', '/trainer', '/parent', '/student'];

for (const route of protectedRoutes) {
  test(`logged-out visitor cannot remain on ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.pathname === '/', { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe('/');
  });
}
