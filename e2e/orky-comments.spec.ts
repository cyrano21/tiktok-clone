import { test, expect } from '@playwright/test';

test.describe('ORKY inline comments', () => {
  test('opens comments over the current video and renders the real scraper comment', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_500);

    // Target the video action, not the bottom-navigation inbox icon.
    const commentButton = page.getByLabel('Ouvrir les commentaires');
    await expect(commentButton.first()).toBeVisible();
    await commentButton.first().click();

    // The sheet must be visible in the viewport, not a separate route/page.
    const title = page.getByRole('heading', { name: 'Commentaires (1)' });
    await expect(title).toBeVisible();
    const box = await title.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(861);

    // Data comes from the scraper API, not demo comments.
    // React Native Web may merge the username and body into one text node;
    // match the real scraper identity without relying on that DOM grouping.
    await expect(page.getByText(/tiktok_tiktok/).first()).toBeVisible();
    await expect(page.getByText(/Spider-Man stars dropped their superhero dream teams/).first()).toBeVisible();

    // The URL remains the feed route; no full-screen comments navigation.
    await expect(page).toHaveURL(/\/$/);
  });
});
