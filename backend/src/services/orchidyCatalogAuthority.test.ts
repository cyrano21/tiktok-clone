import {
  isPublishedOrchidyProjection,
  resolvePublishedOrchidyCatalogItem,
} from './orchidyCatalogAuthority';

describe('Orchidy catalog authority', () => {
  it('accepts only a published and orderable projection', () => {
    expect(isPublishedOrchidyProjection({
      id: 'published-1',
      publicationStatus: 'published',
      visible: true,
      orderable: true,
    })).toBe(true);

    expect(isPublishedOrchidyProjection({
      id: 'supplier-1',
      publicationStatus: 'draft',
      visible: true,
      orderable: true,
    })).toBe(false);

    expect(isPublishedOrchidyProjection({
      id: 'published-2',
      publicationStatus: 'published',
      visible: true,
      orderable: false,
    })).toBe(false);
  });

  it('returns the canonical publishedItemId instead of the requested alias', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        product: {
          id: 'mongo-id',
          publishedItemId: 'canonical-published-id',
          publicationStatus: 'published',
          visible: true,
          orderable: true,
        },
      }),
    });

    await expect(resolvePublishedOrchidyCatalogItem('public-slug', fetchMock)).resolves.toMatchObject({
      ok: true,
      canonicalId: 'canonical-published-id',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/integrations/orky/products/public-slug?market=FR'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects an unavailable authority without creating a local match', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(resolvePublishedOrchidyCatalogItem('anything', fetchMock)).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});
