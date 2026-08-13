import { cleanCommerceDescription, mapOrchidyProduct, resolveOrchidyCategoryFilter } from '../src/services/orchidyProducts';

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

  it('normalizes the informatique catalog and keeps only approved video media', () => {
    const product = mapOrchidyProduct({
      _id: 'product-it',
      slug: 'dock-usb-c',
      title: 'Dock USB-C',
      price: 49,
      currency: 'EUR',
      categorySlug: 'informatique-bureau',
      orderable: true,
      videos: [
        { url: 'https://cdn.example/video.mp4', validationStatus: 'approved' },
        { url: 'https://cdn.example/pending.mp4', validationStatus: 'pending' },
        { url: 'http://unsafe.example/video.mp4', validationStatus: 'approved' },
      ],
    });

    expect(product.category).toBe('informatique');
    expect(product.videos).toEqual([
      { url: 'https://cdn.example/video.mp4', validationStatus: 'approved' },
    ]);
    expect(product.videoAvailable).toBe(true);
    expect(product.badges).toContain('▶ Vidéo');
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

  it('renders supplier HTML as readable text instead of exposing tags', () => {
    const product = mapOrchidyProduct({
      _id: 'power-bank-42',
      slug: 'power-bank-solaire',
      title: 'Power bank solaire',
      description: '<p>Autonomie prolongée.</p><ul><li><strong>Charge rapide :</strong> USB-C.</li><li>Étanche.</li></ul>',
      price: 25.99,
      currency: 'EUR',
    });

    expect(product.description).toBe('Autonomie prolongée.\n• Charge rapide : USB-C.\n• Étanche.');
    expect(product.description).not.toMatch(/<\/?(?:p|ul|li|strong)>/);
  });

  it('unwraps an SEO JSON description and honors an Orchidy canonical URL', () => {
    expect(cleanCommerceDescription(JSON.stringify({
      shortDescription: 'Résumé court',
      longDescription: '<p>Description complète.</p>',
    }))).toBe('Description complète.');

    const product = mapOrchidyProduct({
      _id: 'origin-42',
      slug: 'legacy-slug',
      publicUrl: '/product/canonical-slug-origin-42',
      title: 'Produit canonique',
      description: 'Description.',
      price: 10,
      currency: 'EUR',
    });

    expect(product.externalUrl).toBe('https://orchidy.fr/product/canonical-slug-origin-42');
  });

  it('maps every ORKY shelf to the canonical Marketplace taxonomy', () => {
    expect(resolveOrchidyCategoryFilter('fashion')).toContain('mode-femme');
    expect(resolveOrchidyCategoryFilter('fashion')).toContain('mode-homme');
    expect(resolveOrchidyCategoryFilter('informatique')).toContain('informatique-bureau');
    expect(resolveOrchidyCategoryFilter('home')).toContain('maison-decoration');
    expect(resolveOrchidyCategoryFilter('beauty')).toBe('beaute-soins-personnels');
    expect(resolveOrchidyCategoryFilter('fitness')).toContain('sport-fitness');
  });
});
