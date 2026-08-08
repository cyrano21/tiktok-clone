import { mapOrchidyProduct } from '../src/services/orchidyProducts';

describe('Orchidy product bridge', () => {
  it('maps the public catalog contract and links to the canonical product page', () => {
    const product = mapOrchidyProduct({
      _id: 'product-42',
      slug: 'lampe-sunset',
      title: 'Lampe Sunset',
      description: 'Une lampe tendance.',
      priceClient: 29.9,
      originalPrice: 39.9,
      currency: 'EUR',
      images: ['https://cdn.example/lampe.jpg'],
      category: { name: 'Maison', slug: 'maison' },
      store: { _id: 'store-1', name: 'Orchidy Store', logo: 'https://cdn.example/logo.png' },
      orderable: true,
      stockStatus: 'in_stock',
    });

    expect(product).toEqual(expect.objectContaining({
      id: 'orchidy:lampe-sunset',
      source: 'orchidy',
      price: 29.9,
      currency: '€',
      category: 'home',
      orderable: true,
      externalUrl: 'https://orchidy.fr/product/lampe-sunset',
    }));
  });

  it('does not mark an explicitly unavailable product as orderable', () => {
    const product = mapOrchidyProduct({
      _id: 'product-43',
      slug: 'stock-epuise',
      name: 'Stock épuisé',
      price: 12,
      currency: 'EUR',
      stockStatus: 'out_of_stock',
    });

    expect(product.orderable).toBe(false);
    expect(product.badges).toContain('Indisponible');
  });
});
