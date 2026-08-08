import { useCartStore } from '@/store/cartStore';

const product = {
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
} as any;

function resetStore() {
  useCartStore.setState({ lines: [], pendingHandoffs: {}, lastOrderTotal: null });
}

describe('ORKY cart handoff reconciliation', () => {
  beforeEach(resetStore);

  it('removes only the quantities that belonged to the paid handoff', () => {
    const state = useCartStore.getState();
    state.addToCart(product, 'red-42', 2);
    const snapshot = useCartStore.getState().lines.map((line) => ({ ...line }));
    state.markHandoff('64f000000000000000000001', snapshot);

    // User adds one more unit while the handoff is being paid in another tab.
    useCartStore.getState().addToCart(product, 'red-42', 1);
    expect(useCartStore.getState().lines[0].quantity).toBe(3);

    const reconciled = useCartStore.getState().completeHandoff('64f000000000000000000001');
    expect(reconciled).toBe(true);
    expect(useCartStore.getState().lines[0].quantity).toBe(1);
    expect(useCartStore.getState().pendingHandoffs['64f000000000000000000001']).toBeUndefined();
  });

  it('keeps the full cart when the Orchidy payment is cancelled', () => {
    const state = useCartStore.getState();
    state.addToCart(product, 'red-42', 2);
    state.markHandoff('64f000000000000000000002', useCartStore.getState().lines);

    useCartStore.getState().cancelHandoff('64f000000000000000000002');
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0].quantity).toBe(2);
    expect(useCartStore.getState().pendingHandoffs['64f000000000000000000002']).toBeUndefined();
  });

  it('never lets the legacy checkout helper clear the cart', () => {
    useCartStore.getState().addToCart(product, 'red-42', 1);
    const total = useCartStore.getState().checkout();
    expect(total).toBeGreaterThan(0);
    expect(useCartStore.getState().lines).toHaveLength(1);
  });
});
