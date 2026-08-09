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

  it('preserves real variant identity and selected options for checkout handoff', () => {
    const product = mapOrchidyProduct({
      _id: 'product-variant',
      slug: 'sneakers',
      title: 'Sneakers',
      price: 60,
      currency: 'EUR',
      orderable: true,
      variants: [
        { _id: 'variant-red-42', title: 'Rouge / 42', selectedOptions: { color: 'Rouge', size: '42' }, image: 'https://img/sneaker-rouge.jpg', stock: 7 },
        { sku: 'SKU-BLACK-43', name: 'Noir / 43', attributes: [{ name: 'color', value: 'Noir' }, { name: 'size', value: '43' }] },
      ],
    });

    expect(product.variants).toEqual([
      { id: 'variant-red-42', label: 'Rouge / 42', selectedOptions: { color: 'Rouge', size: '42' }, image: 'https://img/sneaker-rouge.jpg', stock: 7 },
      { id: 'SKU-BLACK-43', label: 'Noir / 43', selectedOptions: { color: 'Noir', size: '43' }, image: null, stock: null },
    ]);
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
