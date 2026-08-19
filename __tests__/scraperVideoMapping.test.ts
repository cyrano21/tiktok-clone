import { toOrkyVideo, ScraperVideo } from '@/services/scraperBridge';

describe('scraper video mapping', () => {
  const base: ScraperVideo = {
    id: 'provider-1',
    title: 'Produit tendance',
    views: 6200000,
    likes: 6200000,
    duration: 12,
    commentCount: 14000,
    url: 'https://www.tiktok.com/@fang/video/provider-1',
    thumbnailUrl: 'https://cdn.example.test/thumb.jpg',
  };

  it('keeps real provider metrics and marks the reference read-only', () => {
    const video = toOrkyVideo({
      ...base,
      shareCount: 676100,
      saveCount: 476500,
      sound: { id: 'sound-1', title: 'Sunset', artist: 'fang', coverUrl: base.thumbnailUrl },
    });

    // Les URLs TikTok signées expirent et sont rejetées depuis une autre IP :
    // miniatures et vidéos passent par le proxy scraper same-origin.
    expect(video.videoUrl).toBe('/api/scraper/stream/provider-1');
    expect(video.thumbnailUrl).toBe('/api/scraper/thumbnail/provider-1');
    expect(video.sound?.coverUrl).toBe(base.thumbnailUrl);
    expect(video.sourceType).toBe('external_reference');
    expect(video.interactionMode).toBe('read_only');
    expect(video.likesCount).toBe(6200000);
    expect(video.commentsCount).toBe(14000);
    expect(video.sharesCount).toBe(676100);
    expect(video.savesCount).toBe(476500);
    expect(video.metricAvailability).toEqual({
      likes: true,
      comments: true,
      shares: true,
      saves: true,
      views: true,
    });
    expect(video.sound?.title).toBe('Sunset');
  });

  it('keeps only an explicit published Orchidy product match', () => {
    const video = toOrkyVideo({
      ...base,
      productMatches: [{ orchidyCatalogItemId: 'published-42', confidence: 0.82 }],
    });

    expect(video.productMatches).toEqual([{
      id: 'scraper-match-provider-1-0',
      orchidyCatalogItemId: 'published-42',
      variantKey: undefined,
      confidence: 0.82,
      source: 'scraper_observation',
    }]);
  });

  it('does not invent unavailable share, save, or sound values', () => {
    const video = toOrkyVideo(base);

    expect(video.sharesCount).toBe(0);
    expect(video.savesCount).toBe(0);
    expect(video.metricAvailability).toEqual({
      likes: true,
      comments: true,
      shares: false,
      saves: false,
      views: true,
    });
    expect(video.sound).toBeNull();
  });

  it('keeps suggestion/approval status so the feed can gate the product pill', () => {
    const video = toOrkyVideo({
      ...base,
      productMatches: [
        { orchidyCatalogItemId: 'suggested-item', confidence: 0.61, status: 'suggested' },
        { orchidyCatalogItemId: 'approved-item', confidence: 0.9, status: 'approved' },
      ],
    });

    expect(video.productMatches?.[0].status).toBe('suggested');
    expect(video.productMatches?.[1].status).toBe('approved');
    expect(video.productMatches?.[1].source).toBe('scraper_observation');
  });

  it('leaves native matches without a status (treated as approved)', () => {
    const video = toOrkyVideo(base);
    expect(video.productMatches).toEqual([]);
  });
});
