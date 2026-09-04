import { toCommerceStats, videoIdFromSignal } from '../src/services/commerceStats';

describe('videoIdFromSignal (Lot 3 — jointure vidéo → signal)', () => {
  it('extrait l’id d’un signal scraper (`trend-…`)', () => {
    expect(videoIdFromSignal('trend-video_abc123')).toBe('video_abc123');
  });

  it('accepte un identifiant simple', () => {
    expect(videoIdFromSignal('video_42')).toBe('video_42');
  });

  it('rejette les chaînes vides ou suspectes', () => {
    expect(videoIdFromSignal('')).toBeNull();
    expect(videoIdFromSignal('trend-')).toBeNull();
  });
});

describe('toCommerceStats (Lot 3 — signal commerce vers Pro)', () => {
  it('mappe un entonnoir avec sessions → commerceStats', () => {
    const stats = toCommerceStats({
      videoId: 'video_1',
      sessionsStarted: 4,
      sessionsCompleted: 3,
      watchCompletionRate: 0.75,
      milestones: { started: 4, completed: 3 },
    });
    expect(stats?.videoId).toBe('video_1');
    expect(stats?.watchSessions).toBe(4);
    expect(stats?.watchCompletionRate).toBe(0.75);
    expect(stats?.aggregatedAt).toBeDefined();
  });

  it('borne le taux de complétion hors bornes', () => {
    const stats = toCommerceStats({
      videoId: 'v',
      sessionsStarted: 1,
      sessionsCompleted: 1,
      watchCompletionRate: 3,
      milestones: {},
    });
    expect(stats?.watchCompletionRate).toBe(1);
  });

  it('aucune session → undefined (le signal part sans commerceStats)', () => {
    expect(
      toCommerceStats({
        videoId: 'v',
        sessionsStarted: 0,
        sessionsCompleted: 0,
        watchCompletionRate: null,
        milestones: {},
      }),
    ).toBeUndefined();
  });

  it('entrées null/undefined → undefined, sans crash', () => {
    expect(toCommerceStats(null)).toBeUndefined();
    expect(toCommerceStats(undefined)).toBeUndefined();
  });
});