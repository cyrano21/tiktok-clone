import { test, expect, type Page, type Route } from '@playwright/test';

test.describe('ORKY content controls', () => {
  const mockProfileApi = async (page: Page) => {
    await page.route('**/v1/auth/me', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-1', username: 'creator', displayName: 'Creator', avatarUrl: null,
            bio: 'Bio', isVerified: false, createdAt: '2026-01-01',
            likeCount: 10,
            _count: { followers: 10, following: 2, videos: 1 },
          },
        }),
      });
    });
    await page.route('**/v1/users/creator/videos**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ videos: [{ id: 'own-video', thumbnailUrl: 'https://example.com/own.jpg', viewCount: 1000, likeCount: 10 }] }),
      });
    });
    await page.route('**/v1/users/creator', async (route: Route) => {
      if (route.request().url().includes('/videos') || route.request().url().includes('/likes')) return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: 'user-1', username: 'creator', likeCount: 10 } }),
      });
    });
    await page.route('**/v1/users/creator/likes**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ videos: [{ id: 'liked-video', thumbnailUrl: 'https://example.com/liked.jpg', viewCount: 2000, likeCount: 20 }] }),
      });
    });
  };

  test('changes profile grid when switching Videos to Liked', async ({ page }) => {
    await mockProfileApi(page);
    await page.addInitScript(() => {
      localStorage.setItem('@auth_token', 'e2e-token');
      localStorage.setItem('@auth_user', JSON.stringify({
        id: 'user-1', username: 'creator', displayName: 'Creator', avatarUrl: null,
      }));
    });
    await page.goto('/');
    await page.getByText('Profil', { exact: true }).click();

    await expect(page.getByTestId('profile-video-own-video')).toBeVisible();
    await expect(page.getByTestId('profile-video-liked-video')).toHaveCount(0);

    await page.getByText('♥ Liked', { exact: true }).click();

    await expect(page.getByTestId('profile-video-liked-video')).toBeVisible();
    await expect(page.getByTestId('profile-video-own-video')).toHaveCount(0);
  });

  test('changes Discover cards when selecting Music', async ({ page }) => {
    await page.route('**/v1/feed/discover**', async (route: Route) => {
      const category = new URL(route.request().url()).searchParams.get('category');
      const videos = category === 'music'
        ? [{ id: 'music-video', title: 'New sound', thumbnailUrl: 'https://example.com/music.jpg', viewCount: 2000 }]
        : [
          { id: 'all-video', title: 'Dance Challenge', thumbnailUrl: 'https://example.com/all.jpg', viewCount: 1000 },
          { id: 'comedy-video', title: 'Comedy Skit', thumbnailUrl: 'https://example.com/comedy.jpg', viewCount: 3000 },
        ];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videos, page: 1, limit: 20, category }) });
    });
    await page.goto('/');
    await page.getByText('Découvrir', { exact: true }).click();

    await expect(page.getByTestId('discover-video-all-video')).toBeVisible();
    await expect(page.getByTestId('discover-video-comedy-video')).toBeVisible();

    await page.getByText('Music', { exact: true }).click();

    await expect(page.getByTestId('discover-video-music-video')).toBeVisible();
    await expect(page.getByTestId('discover-video-comedy-video')).toHaveCount(0);
  });
});
