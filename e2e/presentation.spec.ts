import { test, expect } from '@playwright/test';
test('homepage and mobile navigation render without overflow', async ({ page }) => {
  const failures: string[] = []; page.on('pageerror', e => failures.push(e.message));
  await page.goto('/'); await expect(page.getByRole('heading', { name: /Good food for every mood/ })).toBeVisible();
  await expect(page.locator('.recipe-card')).toHaveCount(3);
  await page.locator('.why-photo').scrollIntoViewIfNeeded();
  await page.locator('.hero').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.hero-food').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click(); await expect(page.getByRole('navigation').getByRole('link', { name: 'My Pantry' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/home-mobile.png', fullPage: true });
  expect(failures).toEqual([]);
});
