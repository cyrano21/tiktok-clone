import { test, expect } from '@playwright/test';

test.describe('ORKY inline comments', () => {
  test('opens comments over the current video and renders the real scraper comment', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_500);

    const commentButtons = page.getByText('💬', { exact: true });
    await expect(commentButtons.first()).toBeVisible();
    await commentButtons.first().click();

    // The sheet must be visible in the viewport, not a separate route/page.
    const title = page.getByText('Commentaires (1)', { exact: true });
    await expect(title).toBeVisible();
    const box = await title.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(861);

    // Data comes from the scraper API, not demo comments.
    await expect(page.getByText('tiktok_tiktok', { exact: true })).toBeVisible();
    await expect(page.getByText('the Spider-Man stars dropped their superhero dream teams… tell us you...', { exact: true })).toBeVisible();

    // The URL remains the feed route; no full-screen comments navigation.
    await expect(page).toHaveURL(/\/$/);
  });
});
