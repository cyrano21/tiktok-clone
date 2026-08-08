import { test, expect, type Page, type Route } from '@playwright/test';

const stabilizeDemoRuntime = async (page: Page) => {
  await page.addInitScript(() => {
    let seed = 0x0f4b5a;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
  });
};

const disableRemoteMedia = async (page: Page) => {
  await page.route('**/v1/**', async (route: Route) => {
    const url = route.request().url();
    if (url.includes('/feed/discover')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videos: [], page: 1, limit: 20, category: 'all' }) });
      return;
    }
    if (url.includes('/feed/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videos: [], page: 1, limit: 10 }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/scraper/stats', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalComments: 128, totalVideos: 12, uniqueUsers: 77, spamCount: 3, lastScraped: '2026-08-08T12:00:00.000Z' }),
    });
  });
};

test.describe('ORKY visual smoke', () => {
  test('renders ORKY feed shell and branded metadata', async ({ page }) => {
    await stabilizeDemoRuntime(page);
    await disableRemoteMedia(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/ORKY/i);
    await expect(page.locator('body')).toContainText('For You');
    await expect(page.locator('body')).toContainText('Accueil');
    await expect(page.locator('body')).toContainText('Découvrir');
    await expect(page.locator('body')).toContainText('Profil');
    await expect(page).toHaveScreenshot('orky-feed.png', { fullPage: true });
  });

  test('navigates to profile and ORKY Studio', async ({ page }) => {
    await stabilizeDemoRuntime(page);
    await disableRemoteMedia(page);
    await page.goto('/');
    await page.getByText('Profil', { exact: true }).click();
    await expect(page.locator('body')).toContainText('ORKY Studio');
    await page.getByText('ORKY Studio', { exact: true }).click();
    await expect(page.locator('body')).toContainText('ORKY Studio');
    await expect(page.locator('body')).toContainText('Scraper Intelligence');
    await expect(page).toHaveScreenshot('orky-studio.png', { fullPage: true });
  });

  test('opens external research as a locked read-only surface without iframe', async ({ page }) => {
    await stabilizeDemoRuntime(page);
    await disableRemoteMedia(page);
    await page.goto('/');
    await page.getByText('Profil', { exact: true }).click();
    await page.getByText('ORKY Studio', { exact: true }).click();
    await page.getByText('Scraper Intelligence', { exact: true }).click();

    await expect(page.getByText('Recherche externe', { exact: true })).toBeVisible();
    await expect(page.getByText('Source de recherche, pas réseau social ORKY', { exact: true })).toBeVisible();
    await expect(page.getByText('12', { exact: true })).toBeVisible();
    await expect(page.getByText('128', { exact: true })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('input')).toHaveCount(0);
    await expect(page).toHaveScreenshot('orky-scraper.png', { fullPage: true });
  });
});
