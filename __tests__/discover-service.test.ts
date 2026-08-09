import { __mapDiscoverVideoForTest } from '../src/services/discoverService';

describe('Discover service', () => {
  it('maps backend metadata into a real Discover card', () => {
    expect(__mapDiscoverVideoForTest({
      id: 'video-1',
      title: 'Dance session',
      thumbnailUrl: 'https://cdn.example/video-1.jpg',
      viewCount: 12500,
      hashtags: [{ id: 'tag-1', name: 'dance' }],
      sound: { title: 'Original sound', artist: 'Creator' },
    })).toEqual(expect.objectContaining({
      id: 'video-1',
      title: 'Dance session',
      thumbnailUrl: 'https://cdn.example/video-1.jpg',
      viewsCount: '12.5K',
      categories: ['dance', 'Original sound', 'Creator'],
    }));
  });

  it('maps Prisma video-hashtag join records returned by /feed/discover', () => {
    expect(__mapDiscoverVideoForTest({
      id: 'video-2',
      description: 'Une recette rapide',
      viewCount: 8,
      hashtags: [{ hashtag: { id: 'tag-2', name: 'food' } }],
      sound: null,
    })).toEqual(expect.objectContaining({
      id: 'video-2',
      title: 'Une recette rapide',
      categories: ['food'],
    }));
  });
});

describe('scraper bridge Discover caching', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    jest.resetModules();
    jest.dontMock('../src/services/scraperBridge');
  });

  it('caches the full catalog so Discover category filters see the whole pool', async () => {
    process.env.NEXT_PUBLIC_SCRAPER_API_URL = '/api/scraper';
    const videos = Array.from({ length: 60 }, (_, i) => ({
      id: `v${i}`,
      title: i < 10 ? 'recette rapide #food' : 'autre contenu #music',
      views: 1000 + i,
      likes: 100,
      duration: 20,
      commentCount: 1,
      url: `https://www.tiktok.com/@tiktok/video/v${i}`,
      thumbnailUrl: `https://cdn.example/t${i}.jpg`,
      hashtags: i < 10 ? ['food', 'recipe'] : ['music', 'song'],
      creatorUsername: 'tiktok',
    }));
    const fetchMock = jest.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/stats')) {
        return { ok: true, json: async () => ({ totalVideos: 60 }) };
      }
      if (String(url).includes('/videos')) {
        return { ok: true, json: async () => ({ videos }) };
      }
      return { ok: false, json: async () => ({}) };
    });
    (global as any).fetch = fetchMock;
    jest.resetModules();
    const { scraperBridge } = await import('../src/services/scraperBridge');
    // A first small read (like the For You feed) must not shrink the cache
    // that Discover later filters.
    const small = await scraperBridge.getVideos(3);
    expect(small).toHaveLength(3);
    const full = await scraperBridge.getVideos(60);
    expect(full).toHaveLength(60);
    const food = full.filter((v) =>
      v.hashtags.some((h) => h.name === 'food')
    );
    expect(food.length).toBeGreaterThanOrEqual(10);
  });
});
