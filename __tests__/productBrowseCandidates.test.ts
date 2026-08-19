import { toBrowseCandidates } from '@/services/productMatchService';
import type { CommerceProduct } from '@/services/orchidyProducts';

describe('toBrowseCandidates', () => {
  const product: CommerceProduct = {
    id: 'orchidy:plus-size-dress',
    externalId: 'plus-size-dress-abc123',
    externalSlug: 'plus-size-dress',
    title: 'Plus Size Dress',
    description: 'Robe',
    price: 47.37,
    originalPrice: 61.58,
    currency: '€',
    images: ['https://cdn.example.test/dress.jpg'],
    rating: 4.5,
    reviewsCount: 12,
    soldCount: 30,
    sellerId: 'orchidy:shop-1',
    shopName: 'Boutique',
    shopAvatar: '',
    category: 'fashion',
    freeShipping: false,
    variants: [],
    badges: ['ORCHIDY'],
    onSale: true,
    source: 'orchidy',
    externalUrl: 'https://orchidy.fr/product/plus-size-dress',
    orderable: true,
  };

  it('maps Orchidy products to approvable candidates (EUR, score 0)', () => {
    const candidates = toBrowseCandidates([product]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      orchidyCatalogItemId: 'plus-size-dress-abc123',
      title: 'Plus Size Dress',
      price: 47.37,
      currency: 'EUR',
      score: 0,
      source: 'catalog_lexical_match',
      requiresApproval: true,
    });
  });

  it('drops non-Orchidy or unidentified products (no manufactured matches)', () => {
    const demo = { ...product, source: 'demo' as const };
    const noId = { ...product, externalId: '', externalSlug: '' };

    expect(toBrowseCandidates([demo, noId])).toHaveLength(0);
  });
});
