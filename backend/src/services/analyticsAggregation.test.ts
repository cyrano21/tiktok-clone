// La DB réelle n'est jamais touchée : les folds purs sont testés avec des
// lignes synthétiques ; le mock évite de spawner le moteur Prisma (qui
// bloquerait la suite sans DATABASE_URL).
jest.mock('../config/database', () => ({
  prisma: {
    analyticsEvent: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

import { foldProductFunnel, foldProductFunnelCounts, foldWatchAggregate } from './analyticsAggregation';

describe('foldWatchAggregate (Lot 3 — signal commerce)', () => {
  it('une lecture à 83 % = 1 session démarrée, complétion 0.75, aucun double comptage', () => {
    // Même scénario que le Gate Lot 2 (4 milestones pour une lecture à 83 %).
    const aggregate = foldWatchAggregate('video_1', [
      { sessionId: 's1', type: 'video_started' },
      { sessionId: 's1', type: 'video_25_percent' },
      { sessionId: 's1', type: 'video_50_percent' },
      { sessionId: 's1', type: 'video_75_percent' },
    ]);
    expect(aggregate.sessionsStarted).toBe(1);
    expect(aggregate.sessionsCompleted).toBe(0);
    expect(aggregate.watchCompletionRate).toBe(0.75);
    expect(aggregate.milestones.started).toBe(1);
    expect(aggregate.milestones.completed).toBe(0);
    // 4 events n'ont produit qu'UNE session — pas de double comptage.
    expect(aggregate.sessionsStarted).not.toBe(4);
  });

  it('une lecture complète = complétion 1.0', () => {
    const aggregate = foldWatchAggregate('video_1', [
      { sessionId: 's1', type: 'video_started' },
      { sessionId: 's1', type: 'video_completed' },
    ]);
    expect(aggregate.sessionsCompleted).toBe(1);
    expect(aggregate.watchCompletionRate).toBe(1);
  });

  it('moyenne multi-sessions pondérée par session, pas par événement', () => {
    const aggregate = foldWatchAggregate('video_1', [
      // Session A : lecture complète (started + completed + replayed).
      { sessionId: 'a', type: 'video_started' },
      { sessionId: 'a', type: 'video_completed' },
      { sessionId: 'a', type: 'video_replayed' },
      // Session B : moitié.
      { sessionId: 'b', type: 'video_started' },
      { sessionId: 'b', type: 'video_50_percent' },
      // Session C : à peine démarrée.
      { sessionId: 'c', type: 'video_started' },
    ]);
    expect(aggregate.sessionsStarted).toBe(3);
    expect(aggregate.sessionsCompleted).toBe(1);
    // (1.0 + 0.5 + 0.0) / 3
    expect(aggregate.watchCompletionRate).toBe(0.5);
    expect(aggregate.milestones.replayed).toBe(1);
  });

  it('aucune session → taux de complétion null', () => {
    const aggregate = foldWatchAggregate('video_1', []);
    expect(aggregate.sessionsStarted).toBe(0);
    expect(aggregate.watchCompletionRate).toBeNull();
  });
});

describe('foldProductFunnel (Lot 3 — entonnoir commerce)', () => {
  it('compte chaque étape de l’entonnoir sans doublon', () => {
    const funnel = foldProductFunnel('product_9', [
      { type: 'product_impression' },
      { type: 'product_impression' },
      { type: 'product_clicked' },
      { type: 'product_detail_viewed' },
      { type: 'add_to_cart' },
      { type: 'remove_from_cart' },
      { type: 'add_to_cart' },
      { type: 'checkout_handoff_created' },
      { type: 'checkout_started' },
      { type: 'checkout_paid' },
    ]);
    expect(funnel).toEqual({
      productId: 'product_9',
      impressions: 2,
      clicks: 1,
      detailViews: 1,
      addToCarts: 2,
      removeFromCarts: 1,
      checkoutHandoffs: 1,
      checkoutsStarted: 1,
      checkoutsCancelled: 0,
      paid: 1,
    });
  });

  it('types non-commerce ignorés', () => {
    const funnel = foldProductFunnel('product_9', [
      { type: 'video_started' },
      { type: 'video_completed' },
      { type: 'creator_followed' },
    ]);
    expect(funnel.addToCarts).toBe(0);
    expect(funnel.paid).toBe(0);
  });

  it('comptage par type équivalent au fold par lignes', () => {
    const rows = [
      { type: 'product_impression' },
      { type: 'product_clicked' },
      { type: 'add_to_cart' },
      { type: 'checkout_paid' },
    ];
    const fromRows = foldProductFunnel('p', rows);
    const counts = { product_impression: 1, product_clicked: 1, add_to_cart: 1, checkout_paid: 1 };
    expect(foldProductFunnelCounts('p', counts)).toEqual(fromRows);
  });
});
