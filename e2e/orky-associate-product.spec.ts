import { test, expect, Page } from '@playwright/test';

// Fixture déterministe : une vidéo externe avec une suggestion produit auto.
const SCRAPER_VIDEO_ID = '7579590985483570446';
const SUGGESTED_ITEM = 'lampe-sunset-projection';
const CANDIDATE = {
  orchidyCatalogItemId: SUGGESTED_ITEM,
  title: 'Lampe Sunset Projection LED',
  slug: SUGGESTED_ITEM,
  images: ['https://cdn.example.test/lampe.jpg'],
  price: 12.99,
  currency: 'EUR',
  score: 0.71,
  source: 'catalog_lexical_match',
  requiresApproval: true,
};

const SCRAPER_VIDEO = {
  id: SCRAPER_VIDEO_ID,
  title: 'Découvrez la lampe sunset projection ! #lampe #sunset',
  views: 6200000,
  likes: 6200000,
  duration: 12,
  commentCount: 14000,
  url: `https://www.tiktok.com/@fang/video/${SCRAPER_VIDEO_ID}`,
  thumbnailUrl: 'https://cdn.example.test/thumb.jpg',
  hashtags: ['lampe', 'sunset'],
  creatorUsername: 'fang',
  creatorDisplayName: 'fang',
  productMatches: [
    { orchidyCatalogItemId: SUGGESTED_ITEM, confidence: 0.71, source: 'catalog_lexical_match', status: 'suggested' },
  ],
};

const ORCHIDY_PRODUCT = {
  slug: SUGGESTED_ITEM,
  title: 'Lampe Sunset Projection LED',
  price: 12.99,
  currency: 'EUR',
  images: ['https://cdn.example.test/lampe.jpg'],
  orderable: true,
  variants: [],
};

async function mockApis(page: Page) {
  await page.route('**/api/scraper/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalComments: 1, totalVideos: 1, uniqueUsers: 1, spamCount: 0, lastScraped: '' }),
    });
  });
  await page.route('**/api/scraper/videos', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ videos: [SCRAPER_VIDEO], count: 1 }),
    });
  });
  await page.route(`**/api/scraper/videos/${SCRAPER_VIDEO_ID}/product-matches`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, videoId: SCRAPER_VIDEO_ID }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/product-matches/candidates*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ candidates: [CANDIDATE] }),
    });
  });
  await page.route('**/api/orchidy/products/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ product: ORCHIDY_PRODUCT }),
    });
  });
  // Le stream vidéo échouera silencieusement : seul le rendu du flux compte ici.
  await page.route('**/api/scraper/stream/*', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

test.describe('ORKY associate a product on an external video', () => {
  test('approves a suggested Orchidy product and renders the buyable pill', async ({ page }) => {
    await mockApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    // La vidéo externe apparaît avec son pill « Produit suggéré · à associer ».
    const suggestionPill = page.getByText('Produit suggéré · à associer');
    await expect(suggestionPill.first()).toBeVisible({ timeout: 15_000 });

    // Ouvrir la sheet d'association depuis le pill.
    await suggestionPill.first().click();
    const sheetTitle = page.getByText('Associer un produit');
    await expect(sheetTitle.first()).toBeVisible();

    // La recherche pré-remplie retourne le candidat du catalogue.
    const approve = page.getByRole('button', { name: 'Associer', exact: true });
    await expect(approve.first()).toBeVisible({ timeout: 15_000 });

    // Approuver : la requête POST est émise et la vidéo passe en approuvé.
    const [postRequest] = await Promise.all([
      page.waitForRequest((request) =>
        request.method() === 'POST' && request.url().includes(`/api/scraper/videos/${SCRAPER_VIDEO_ID}/product-matches`),
      ),
      approve.first().click(),
    ]);
    expect(postRequest).toBeTruthy();
    const body = postRequest.postDataJSON();
    expect(body.orchidyCatalogItemId).toBe(SUGGESTED_ITEM);

    // Le feed re-rend la vidéo avec le pill achetable (« Voir »).
    await expect(page.getByText('Produit Orchidy vérifié au checkout').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Voir', exact: true }).first()).toBeVisible();
  });

  test('opens the associate sheet from the manual button when no suggestion exists', async ({ page }) => {
    await mockApis(page);
    // Sans suggestion : seule la pastille « ＋ Associer un produit » est proposée.
    await page.route('**/api/scraper/videos', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ videos: [{ ...SCRAPER_VIDEO, productMatches: [] }], count: 1 }),
      });
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    const manualButton = page.getByText('＋ Associer un produit');
    await expect(manualButton.first()).toBeVisible({ timeout: 15_000 });
    await manualButton.first().click();

    await expect(page.getByText('Associer un produit').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Associer', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });
});
