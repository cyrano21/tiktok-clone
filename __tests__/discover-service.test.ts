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
