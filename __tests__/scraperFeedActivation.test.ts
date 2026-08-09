describe('production scraper feed activation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    jest.resetModules();
    jest.dontMock('../src/services/scraperBridge');
  });

  it('uses real scraper videos when NEXT_PUBLIC_USE_SCRAPER_FEED is true', async () => {
    process.env.NEXT_PUBLIC_USE_DEMO = 'false';
    process.env.NEXT_PUBLIC_USE_SCRAPER_FEED = 'true';

    jest.doMock('../src/services/scraperBridge', () => ({
      scraperBridge: {
        isAvailable: jest.fn().mockResolvedValue(true),
        getVideos: jest.fn().mockResolvedValue([
          { id: 'scraper-real-1', description: 'real TikTok reference' },
        ]),
      },
    }));

    const { feedService } = await import('../src/services/feedService');
    await expect(feedService.getFeed({ limit: 10 })).resolves.toEqual({
      videos: [{ id: 'scraper-real-1', description: 'real TikTok reference' }],
      cursor: 'scraper-1',
      hasMore: false,
    });
  });
});
