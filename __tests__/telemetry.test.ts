import {
  createWatchTracker,
  flushNow,
  resetTelemetryForTests,
  setTelemetryTransport,
  TELEMETRY_EVENT_TYPES,
  track,
  type TelemetryBatch,
} from '../src/services/telemetry';

describe('Watch tracker — Lot 2 (gate 83 %)', () => {
  it('lecture à 83 % : un seul événement par milestone, aucun double comptage', () => {
    const tracker = createWatchTracker();
    const collected: string[] = [];

    // Montée progressive simulée : 0 % → 20 % → 50 % → 83 %.
    for (const progress of [0.02, 0.2, 0.5, 0.83]) {
      for (const event of tracker.onProgress(progress)) collected.push(event.type);
    }

    expect(collected).toEqual(['video_started', 'video_25_percent', 'video_50_percent', 'video_75_percent']);
    expect(collected.length).toBe(4);
  });

  it('les 25/50/75 % ne sont comptés qu’une fois, même avec des updates répétés', () => {
    const tracker = createWatchTracker();
    tracker.onProgress(0.05); // started
    tracker.onProgress(0.5);
    const second = tracker.onProgress(0.5); // même valeur rejouée
    expect(second).toEqual([]);
    const at83 = tracker.onProgress(0.83);
    expect(at83.map((e) => e.type)).toEqual(['video_75_percent']);
    // Pas de re-émission du 50 % déjà passé.
    expect(at83.map((e) => e.type)).not.toContain('video_50_percent');
  });

  it('completed émis une seule fois à 100 %, puis replayed au retour de boucle', () => {
    const tracker = createWatchTracker();
    tracker.onProgress(0.05);
    const end = tracker.onProgress(1);
    // Un saut direct à 100 % émet chaque milestone manquant exactement une fois.
    expect(end.map((e) => e.type)).toEqual([
      'video_25_percent',
      'video_50_percent',
      'video_75_percent',
      'video_completed',
    ]);
    expect(tracker.onProgress(1)).toEqual([]);

    // Boucle (repeat) : retour proche de 0 après complétion.
    const replay = tracker.onProgress(0.01);
    expect(replay.map((e) => e.type)).toEqual(['video_replayed']);

    // Nouveau cycle : started + milestones repartent, sans doublon du cycle précédent.
    const nextLoop = tracker.onProgress(0.4);
    expect(nextLoop.map((e) => e.type)).toEqual(['video_started', 'video_25_percent']);
  });

  it('n’émet rien tant que la lecture n’a pas réellement démarré', () => {
    const tracker = createWatchTracker();
    expect(tracker.onProgress(0)).toEqual([]);
    expect(tracker.onProgress(0.01)).toEqual([]);
  });
});

describe('Telemetry client — batching / flush', () => {
  const sent: TelemetryBatch[] = [];

  beforeEach(() => {
    sent.length = 0;
    resetTelemetryForTests();
    setTelemetryTransport(async (batch) => {
      sent.push(batch);
      return { accepted: batch.events.length, duplicates: 0 };
    });
  });

  afterAll(() => {
    resetTelemetryForTests();
    setTelemetryTransport(null);
  });

  it('envoie le buffer en UN seul appel réseau avec des eventId uniques', async () => {
    track('video_started', { videoId: 'v1' });
    track('video_25_percent', { videoId: 'v1', payload: { watchPercentage: 25 } });
    track('add_to_cart', { productId: 'p1' });

    const result = await flushNow();
    expect(result).toEqual({ accepted: 3, duplicates: 0 });
    expect(sent).toHaveLength(1);
    const batch = sent[0];
    expect(batch.sessionId).toBeTruthy();
    expect(batch.events).toHaveLength(3);
    const ids = new Set(batch.events.map((e) => e.eventId));
    expect(ids.size).toBe(3);
    expect(batch.events.every((e) => typeof e.ts === 'string' && e.ts.length > 0)).toBe(true);
    expect(batch.events.map((e) => e.type).sort()).toEqual(['add_to_cart', 'video_25_percent', 'video_started']);
  });

  it('un flush sur buffer vide ne fait aucun appel réseau', async () => {
    resetTelemetryForTests();
    expect(await flushNow()).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('un flush après le premier ne renvoie pas les événements déjà partis', async () => {
    track('video_completed', { videoId: 'v1' });
    await flushNow();
    expect(sent).toHaveLength(1);
    const again = await flushNow();
    expect(again).toBeNull();
    expect(sent).toHaveLength(1);
  });

  it('expose les 19 types d’événements du plan', () => {
    expect(TELEMETRY_EVENT_TYPES).toHaveLength(19);
  });
});