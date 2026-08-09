import { test, expect, type Page, type Route } from '@playwright/test';

const product = {
  _id: 'product-42',
  id: 'product-42',
  slug: 'lampe-sunset',
  title: 'Lampe Sunset',
  name: 'Lampe Sunset',
  description: 'Une lampe tendance pour créer une ambiance chaleureuse.',
  price: 29.9,
  originalPrice: 39.9,
  currency: 'EUR',
  images: ['https://cdn.example/lampe-sunset.jpg'],
  category: { name: 'Maison', slug: 'maison' },
  store: { _id: 'store-1', name: 'Orchidy Home', logo: 'https://cdn.example/orchidy-home.png', isVerified: true },
  variants: [
    { id: 'black', name: 'Noir', stock: 8 },
    { id: 'red', name: 'Rouge', stock: 5, selectedOptions: { color: 'Rouge' } },
  ],
  rating: 4.8,
  reviewCount: 128,
  soldCount: 640,
  orderable: true,
  stockStatus: 'in_stock',
  availabilityLabel: 'En stock',
  freeShipping: true,
};

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function commonRoutes(page: Page) {
  await page.route('https://cdn.example/**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: pixel });
  });
  await page.route('**/v1/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/feed/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videos: [], page: 1, limit: 10 }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function mockOrchidyCatalog(page: Page, onSearch?: (url: URL) => void) {
  await commonRoutes(page);
  await page.route('**/api/orchidy/products**', async (route: Route) => {
    const url = new URL(route.request().url());
    onSearch?.(url);
    if (/\/api\/orchidy\/products\/lampe-sunset$/.test(url.pathname)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, source: 'orchidy', product }) });
      return;
    }
    const q = url.searchParams.get('q') || '';
    const products = q && !'lampe sunset'.includes(q.toLowerCase()) ? [] : [product];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, source: 'orchidy', products, pagination: { page: 1, limit: 24, total: products.length, pages: 1, hasMore: false } }),
    });
  });
}

async function openShop(page: Page) {
  await page.goto('/');
  await page.getByText('Shop', { exact: true }).last().click();
}

test.describe('ORKY Shop reality integration', () => {
  test('renders real Orchidy products and sends typed search to the API', async ({ page }) => {
    let lastQuery = '';
    await mockOrchidyCatalog(page, (url) => { lastQuery = url.searchParams.get('q') || ''; });
    await openShop(page);

    await expect(page.getByText('Produits réels Orchidy', { exact: true })).toBeVisible();
    await expect(page.getByText('Lampe Sunset', { exact: true })).toBeVisible();
    const search = page.getByLabel('Rechercher un produit Orchidy');
    await search.fill('Lampe');
    await expect.poll(() => lastQuery).toBe('Lampe');
    await expect(page.getByText('Résultats Orchidy pour « Lampe »', { exact: true })).toBeVisible();
  });

  test('does not silently replace an Orchidy outage with demo products', async ({ page }) => {
    await commonRoutes(page);
    await page.route('**/api/orchidy/products**', async (route) => {
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'ORCHIDY_PRODUCTS_UNAVAILABLE' }) });
    });
    await openShop(page);
    await expect(page.getByText('Catalogue momentanément indisponible', { exact: true })).toBeVisible();
    await expect(page.getByText('Lampe Sunset', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Mode démonstration/)).toHaveCount(0);
  });

  test('preserves variant and quantity in the secure Orchidy handoff and snapshots the cart', async ({ page }) => {
    await mockOrchidyCatalog(page);
    let handoffBody: any = null;

    await page.route('**/api/orchidy/checkout-handoff', async (route: Route) => {
      handoffBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          handoffId: '64f000000000000000000001',
          checkoutUrl: 'http://127.0.0.1:3100/handoff-test',
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
          currency: 'EUR',
          total: 59.8,
          validatedLines: [],
          clientPricesIgnored: true,
        }),
      });
    });
    await page.route('**/handoff-test', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Orchidy handoff</h1>' });
    });

    await openShop(page);
    await page.getByText('Lampe Sunset', { exact: true }).click();
    await expect(page.getByText('Produit Orchidy réel', { exact: true })).toBeVisible();
    await page.getByText('Rouge', { exact: true }).click();
    await page.getByText('+', { exact: true }).click();
    await page.getByText('Ajouter au panier', { exact: true }).click();
    await expect(page.getByText('✓ Ajouté', { exact: true })).toBeVisible();
    await page.getByText('🛒').last().click();
    await expect(page.getByText('Checkout sécurisé par Orchidy', { exact: true })).toBeVisible();
    await page.getByText('Continuer vers le paiement Orchidy', { exact: true }).click();
    await expect(page).toHaveURL(/\/handoff-test$/);

    expect(handoffBody).toEqual(expect.objectContaining({
      items: [expect.objectContaining({ productId: 'product-42', variantKey: 'red', quantity: 2, selectedOptions: { color: 'Rouge' } })],
    }));
  });

  test('offers real shoppable-video creation instead of a fake seller rating', async ({ page }) => {
    await mockOrchidyCatalog(page);
    await openShop(page);
    await page.getByText('Lampe Sunset', { exact: true }).click();
    await expect(page.getByText('Boutique Orchidy', { exact: true })).toBeVisible();
    await expect(page.getByText('★ 4.9', { exact: true })).toHaveCount(0);
    await expect(page.getByText('🎬 Créer une vidéo shoppable', { exact: true })).toBeVisible();
  });
});
