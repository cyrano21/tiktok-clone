import { createOrchidyCheckoutHandoff } from '@/services/orchidyCheckout';
import { sanitizeHandoffRequestId } from '@/services/handoffRequestId';
import { mapOrchidyProduct } from '@/services/orchidyProducts';

const VALID_REQUEST_ID = 'req123abc456xyz789';

function handoffResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      handoffId: '64f000000000000000000001',
      checkoutUrl: 'https://orchidy.example.test/checkout/handoff/token',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      currency: 'EUR',
      total: 39.8,
      validatedLines: [],
      clientPricesIgnored: true,
    }),
  };
}

function commerceProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'orchidy:catalog-1',
    title: 'Produit Orchidy',
    description: 'Produit réel',
    price: 19.9,
    originalPrice: 19.9,
    currency: '€',
    images: ['https://example.test/product.jpg'],
    rating: 0,
    reviewsCount: 0,
    soldCount: 0,
    sellerId: 'orchidy:seller-1',
    shopName: 'Boutique',
    shopAvatar: '',
    category: 'all',
    freeShipping: true,
    variants: [{ id: 'red-42', label: 'Rouge / 42', selectedOptions: { color: 'Rouge', size: '42' } }],
    badges: ['ORCHIDY'],
    onSale: false,
    source: 'orchidy',
    externalId: 'catalog-1',
    externalSlug: 'catalog-1',
    orderable: true,
    ...overrides,
  } as any;
}

function cartLine(overrides: Record<string, unknown> = {}) {
  return {
    key: 'orchidy:catalog-1::red-42',
    productId: 'orchidy:catalog-1',
    variantId: 'red-42',
    variantLabel: 'Rouge / 42',
    selectedOptions: { color: 'Rouge', size: '42' },
    quantity: 2,
    productSnapshot: commerceProduct(overrides),
  } as any;
}

describe('handoff requestId contract', () => {
  it('accepts the same lexical shape as the generated-video import route', () => {
    expect(sanitizeHandoffRequestId(VALID_REQUEST_ID)).toBe(VALID_REQUEST_ID);
    expect(sanitizeHandoffRequestId('a'.repeat(40))).toBe('a'.repeat(40));
  });

  it('rejects malformed or missing ids without throwing', () => {
    expect(sanitizeHandoffRequestId(undefined)).toBeUndefined();
    expect(sanitizeHandoffRequestId('')).toBeUndefined();
    expect(sanitizeHandoffRequestId('short')).toBeUndefined();
    expect(sanitizeHandoffRequestId('a'.repeat(41))).toBeUndefined();
    expect(sanitizeHandoffRequestId('has-hyphen-or_underscore')).toBeUndefined();
    expect(sanitizeHandoffRequestId(12345)).toBeUndefined();
    expect(sanitizeHandoffRequestId({})).toBeUndefined();
  });

  it('sends the requestId through the checkout handoff when the snapshot carries one', async () => {
    const fetchMock = jest.fn(async () => handoffResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    await createOrchidyCheckoutHandoff([
      cartLine({ requestId: VALID_REQUEST_ID }),
    ]);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.items[0].requestId).toBe(VALID_REQUEST_ID);
    expect(body.items[0].productId).toBe('catalog-1');
  });

  it('omits the requestId when the snapshot has none or an invalid one', async () => {
    const fetchMock = jest.fn(async () => handoffResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    await createOrchidyCheckoutHandoff([
      cartLine({ requestId: 'bad-id!' }),
      cartLine({}),
    ]);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.items).toHaveLength(2);
    expect(body.items[0].requestId).toBeUndefined();
    expect(body.items[1].requestId).toBeUndefined();
  });

  it('normalizes requestId from upstream product fields and drops invalid values', () => {
    expect(mapOrchidyProduct({ id: 'p1', requestId: VALID_REQUEST_ID }).requestId).toBe(
      VALID_REQUEST_ID,
    );
    expect(mapOrchidyProduct({ id: 'p2', sourceRequestId: VALID_REQUEST_ID }).requestId).toBe(
      VALID_REQUEST_ID,
    );
    expect(mapOrchidyProduct({ id: 'p3', requestId: 'not-valid!' }).requestId).toBeUndefined();
    expect(mapOrchidyProduct({ id: 'p4' }).requestId).toBeUndefined();
  });
});
