import {
  rankCatalogCandidates,
  scoreCatalogCandidate,
  tokenizeCatalogQuery,
} from './orchidyCatalogMatcher';

describe('Orchidy catalog matcher', () => {
  it('normalizes meaningful product terms without treating generic words as evidence', () => {
    expect(tokenizeCatalogQuery('New product for women floral lace dress')).toEqual([
      'women',
      'floral',
      'lace',
      'dress',
    ]);
  });

  it('scores lexical overlap as a candidate signal, not a decision', () => {
    expect(scoreCatalogCandidate('floral lace dress women', 'Floral Lace Dress For Women')).toBe(1);
    expect(scoreCatalogCandidate('floral lace dress women', 'USB C Hub 4 in 1')).toBe(0);
  });

  it('returns only published orderable candidates and requires explicit approval', () => {
    const candidates = rankCatalogCandidates('floral lace women', [
      {
        id: 'published-1',
        title: 'Floral Lace Set For Women',
        publicationStatus: 'published',
        visible: true,
        orderable: true,
        images: ['https://cdn.example/item.jpg'],
        price: 23.54,
        currency: 'EUR',
      },
      {
        id: 'draft-1',
        title: 'Floral Lace Set For Women',
        publicationStatus: 'draft',
        visible: true,
        orderable: true,
      },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      orchidyCatalogItemId: 'published-1',
      requiresApproval: true,
      source: 'catalog_lexical_match',
    });
  });
});
