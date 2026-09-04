import Fastify from 'fastify';
import { telemetryRoutes, TELEMETRY_EVENT_TYPES } from './telemetry.routes';

const mockFindMany = jest.fn();
const mockCreateMany = jest.fn();
const mockGroupBy = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    analyticsEvent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      createMany: (...args: unknown[]) => mockCreateMany(...args),
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
  },
}));

function buildApp() {
  const app = Fastify();
  app.register(telemetryRoutes);
  return app;
}

/** Milestones émis pour une lecture à 83 % (cf. tracker client). */
function watchTo83Percent() {
  return [
    { eventId: 'evt_started_0001', type: 'video_started', ts: '2026-09-01T10:00:00.000Z' },
    { eventId: 'evt_25_0001', type: 'video_25_percent', ts: '2026-09-01T10:00:04.000Z' },
    { eventId: 'evt_50_0001', type: 'video_50_percent', ts: '2026-09-01T10:00:08.000Z' },
    { eventId: 'evt_75_0001', type: 'video_75_percent', ts: '2026-09-01T10:00:12.000Z' },
  ];
}

describe('POST /v1/telemetry/batch', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockCreateMany.mockReset();
    mockFindMany.mockResolvedValue([]);
    mockCreateMany.mockResolvedValue({ count: 0 });
  });

  it('accepte une lecture à 83 % : 4 milestones, aucun doublon', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/batch',
      payload: { sessionId: 'session_abc', events: watchTo83Percent() },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ accepted: 4, duplicates: 0 });
    expect(mockCreateMany).toHaveBeenCalledTimes(1);
    const inserted = mockCreateMany.mock.calls[0][0].data;
    expect(inserted).toHaveLength(4);
    const types = inserted.map((row: { type: string }) => row.type).sort();
    expect(types).toEqual(['video_25_percent', 'video_50_percent', 'video_75_percent', 'video_started']);
    await app.close();
  });

  it('ne compte pas deux fois un même eventId (idempotence inter-batch)', async () => {
    const app = buildApp();
    const events = watchTo83Percent();
    // Premier envoi : rien en base.
    mockFindMany.mockResolvedValueOnce([]);
    const first = await app.inject({
      method: 'POST',
      url: '/batch',
      payload: { sessionId: 'session_abc', events },
    });
    expect(first.json()).toEqual({ accepted: 4, duplicates: 0 });

    // Rejeu du même lot : la base contient déjà les 4 eventId.
    mockFindMany.mockResolvedValueOnce(events.map((event) => ({ eventId: event.eventId })));
    const callsBefore = mockCreateMany.mock.calls.length;
    const second = await app.inject({
      method: 'POST',
      url: '/batch',
      payload: { sessionId: 'session_abc', events },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ accepted: 0, duplicates: 4 });
    // Aucun nouvel insert : l'eventId n'est jamais compté deux fois.
    expect(mockCreateMany.mock.calls.length).toBe(callsBefore);
    await app.close();
  });

  it('déduplique dans un même lot (doublon local ignoré)', async () => {
    const app = buildApp();
    const events = [...watchTo83Percent(), watchTo83Percent()[0]];
    const response = await app.inject({
      method: 'POST',
      url: '/batch',
      payload: { sessionId: 'session_abc', events },
    });
    expect(response.json()).toEqual({ accepted: 4, duplicates: 1 });
    await app.close();
  });

  it('rejette un type d’événement inconnu (400)', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/batch',
      payload: {
        sessionId: 'session_abc',
        events: [{ eventId: 'evt_unknown_0001', type: 'video_every_frame' }],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(mockCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejette un lot vide (400)', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/batch',
      payload: { sessionId: 'session_abc', events: [] },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('GET /funnel — refuse une requête sans videoId ni productId (400)', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/funnel' });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('GET /funnel — agrège l’entonnoir vidéo (une session à 83 % → complétion 0.75)', async () => {
    mockFindMany.mockResolvedValueOnce([
      { sessionId: 's1', type: 'video_started' },
      { sessionId: 's1', type: 'video_25_percent' },
      { sessionId: 's1', type: 'video_50_percent' },
      { sessionId: 's1', type: 'video_75_percent' },
    ]);
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/funnel?videoId=video_1' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.video).not.toBeNull();
    expect(body.video.videoId).toBe('video_1');
    expect(body.video.sessionsStarted).toBe(1);
    expect(body.video.watchCompletionRate).toBe(0.75);
    expect(body.product).toBeNull();
    await app.close();
  });

  it('GET /funnel — agrège l’entonnoir produit par type', async () => {
    mockGroupBy.mockResolvedValueOnce([
      { type: 'product_impression', _count: { _all: 5 } },
      { type: 'product_clicked', _count: { _all: 2 } },
      { type: 'add_to_cart', _count: { _all: 1 } },
      { type: 'checkout_paid', _count: { _all: 1 } },
    ]);
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/funnel?productId=product_9' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.product).toEqual({
      productId: 'product_9',
      impressions: 5,
      clicks: 2,
      detailViews: 0,
      addToCarts: 1,
      removeFromCarts: 0,
      checkoutHandoffs: 0,
      checkoutsStarted: 0,
      checkoutsCancelled: 0,
      paid: 1,
    });
    expect(body.video).toBeNull();
    await app.close();
  });

  it('expose les 19 types d’événements du plan', () => {
    expect(TELEMETRY_EVENT_TYPES).toHaveLength(19);
    expect(TELEMETRY_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        'video_started',
        'video_25_percent',
        'video_50_percent',
        'video_75_percent',
        'video_completed',
        'video_replayed',
        'video_shared',
        'video_saved',
        'creator_followed',
        'product_impression',
        'product_clicked',
        'product_detail_viewed',
        'add_to_cart',
        'remove_from_cart',
        'checkout_handoff_created',
        'checkout_started',
        'checkout_cancelled',
        'checkout_paid',
      ]),
    );
  });
});