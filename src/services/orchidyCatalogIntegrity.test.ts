import { describe, expect, it } from '@jest/globals';
import { getPublicProductImages, isOrchidyBridgeProductUsable } from './orchidyCatalogIntegrity';

const product = {
  title: 'Chargeur GaN 65 W',
  price: 36.02,
  currency: 'EUR',
  orderable: true,
  publicationStatus: 'published',
  images: [
    'https://cdn.example.com/a.jpg',
    'https://cdn.example.com/b.jpg',
    'https://cdn.example.com/c.jpg',
  ],
};

describe('Orchidy catalog integrity', () => {
  it('accepts complete EUR products', () => {
    expect(isOrchidyBridgeProductUsable(product, 'FR')).toBe(true);
  });

  it('rejects USD products for France', () => {
    expect(isOrchidyBridgeProductUsable({ ...product, currency: 'USD' }, 'FR')).toBe(false);
  });

  it('rejects image-less products', () => {
    expect(isOrchidyBridgeProductUsable({ ...product, images: [] }, 'FR')).toBe(false);
  });

  it('accepts single-image products (upstream published items)', () => {
    expect(isOrchidyBridgeProductUsable({ ...product, images: ['https://cdn.example.com/a.jpg'] }, 'FR')).toBe(true);
  });

  it('keeps only unique remote images', () => {
    expect(getPublicProductImages({
      images: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/a.jpg', '/local.jpg'],
      image: 'https://cdn.example.com/b.jpg',
    })).toHaveLength(2);
  });
});
