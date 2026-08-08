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
  store: {
    _id: 'store-1',
    name: 'Orchidy Home',
    logo: 'https://cdn.example/orchidy-home.png',
    isVerified: true,
  },
  rating: 4.8,
  reviewCount: 128,
  soldCount: 640,
  orderable: true,
  stockStatus: 'in_stock',
  availabilityLabel: 'En stock',
  freeShipping: true,
};

async function mockOrchidyCatalog(page: Page) {
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

  await page.route('**/api/orchidy/products**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        source: 'orchidy',
        products: [product],
        pagination: { page: 1, limit: 24, total: 1, pages: 1, hasMore: false },
      }),
    });
  });
  await page.route('**/api/orchidy/products/lampe-sunset', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, source: 'orchidy', product }),
    });
  });
  await page.route('https://cdn.example/**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: pixel });
  });
  await page.route('https://i.pravatar.cc/**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: pixel });
  });
  await page.route('**/v1/**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

test.describe('ORKY Shop visual flow', () => {
  test('renders a real Orchidy catalog card and a truthful source label', async ({ page }) => {
    await mockOrchidyCatalog(page);
    await page.goto('/');

    await page.getByText('Shop', { exact: true }).last().click();
    await expect(page.getByText('Produits réels Orchidy', { exact: true })).toBeVisible();
    await expect(page.getByText('Lampe Sunset', { exact: true })).toBeVisible();
    await expect(page.getByText('Orchidy', { exact: true }).first()).toBeVisible();
    await expect(page).toHaveScreenshot('orky-shop-orchidy.png', { fullPage: true });
  });

  test('opens the Orchidy product page and preserves the product in the cart', async ({ page }) => {
    await mockOrchidyCatalog(page);
    await page.goto('/');

    await page.getByText('Shop', { exact: true }).last().click();
    await page.getByText('Lampe Sunset', { exact: true }).click();

    await expect(page.getByText('Produit Orchidy réel', { exact: true })).toBeVisible();
    await expect(page.getByText('Vidéo optionnelle', { exact: true })).toBeVisible();
    await expect(page.getByText('Acheter sur Orchidy', { exact: true })).toBeVisible();
    await page.getByText('Ajouter au panier', { exact: true }).click();
    await expect(page.getByText('✓ Ajouté', { exact: true })).toBeVisible();

    await page.getByText('🛒').last().click();
    await expect(page.getByText('Produits Orchidy réels', { exact: true })).toBeVisible();
    await expect(page.getByText('Le panier ORKY conserve la sélection.', { exact: false })).toBeVisible();
    await expect(page.getByText('Finaliser sur Orchidy', { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot('orky-cart-orchidy.png', { fullPage: true });
  });
});
