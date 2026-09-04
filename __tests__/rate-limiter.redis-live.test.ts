import { createClient } from 'redis';
import {
  COST_APPROVE,
  COST_CREATE,
  COST_GET,
  RATE_LIMIT_LUA,
  consumeWithClient,
} from '../src/lib/rateLimit/redisRateLimiter';
import type { RateLimitClient } from '../src/lib/rateLimit/redisRateLimiter';

/**
 * LOT 4 — GATE contre un VRAI redis-server (remplace la preuve sur faux
 * client). Deux « instances » = deux clients redis distincts connectés au
 * même serveur : les compteurs vivent dans Redis, pas dans le client.
 *
 * Activation : REDIS_LIVE_TEST_URL=redis://127.0.0.1:6390 npx jest __tests__/rate-limiter.redis-live.test.ts
 * (skippé si la variable est absente — CI sans Redis).
 */

jest.setTimeout(60_000);

const url = process.env.REDIS_LIVE_TEST_URL;
const describeLive = url ? describe : describe.skip;

function asSeam(client: ReturnType<typeof createClient>): RateLimitClient {
  // Même adaptation qu'en production : signature étroite du seam + arguments
  // en chaînes + `.bind(client)` (champs privés de la classe redis).
  const evalFn = (client.eval as unknown as RateLimitClient['eval']).bind(client);
  return {
    eval: (script, options) =>
      evalFn(script, {
        keys: options.keys,
        arguments: options.arguments.map((value) => String(value)),
      }),
  };
}

describeLive('LOT 4 — rate limiting Redis (live, deux instances)', () => {
  const suffix = `live-${process.pid}-${Date.now()}`;
  let instanceA: ReturnType<typeof createClient>;
  let instanceB: ReturnType<typeof createClient>;

  beforeAll(async () => {
    instanceA = createClient({ url: url!, socket: { connectTimeout: 5000 } });
    instanceB = createClient({ url: url!, socket: { connectTimeout: 5000 } });
    await Promise.all([instanceA.connect(), instanceB.connect()]);
    await instanceA.flushDb();
  }, 60_000);

  afterAll(async () => {
    await instanceA?.flushDb().catch(() => undefined);
    await Promise.all([
      instanceA?.quit().catch(() => undefined),
      instanceB?.quit().catch(() => undefined),
    ]);
  }, 60_000);

  async function userCounter(userId: string): Promise<number> {
    const raw = await instanceA.get(`rate:user:${userId}`);
    return raw ? Number(raw) : 0;
  }

  it('Gate : l’instance B voit exactement le compteur consommé par A', async () => {
    const userId = `gate-${suffix}`;
    const seamA = asSeam(instanceA);
    const seamB = asSeam(instanceB);

    for (let i = 0; i < 6; i += 1) {
      const decision = await consumeWithClient(
        seamA,
        { userId },
        COST_GET,
        { windowSeconds: 30, userMax: 6, sourcingUserMax: 999 },
      );
      expect(decision.allowed).toBe(true);
      expect(decision.source).toBe('redis');
    }
    expect(await userCounter(userId)).toBe(6); // 6 × coût 1

    const refused = await consumeWithClient(
      seamB,
      { userId },
      COST_GET,
      { windowSeconds: 30, userMax: 6, sourcingUserMax: 999 },
    );
    expect(refused.allowed).toBe(false);
    expect(refused.failingBucket).toBe('user');
    expect(refused.source).toBe('redis');
    expect(refused.retryAfter).toBeGreaterThan(0);
    expect(refused.retryAfter).toBeLessThanOrEqual(30);
    // Rollback : le refus n'incrémente rien (all-or-nothing).
    expect(await userCounter(userId)).toBe(6);
  });

  it('coûts pondérés : approve (10) épuise le bucket sourcing avant le user', async () => {
    const userId = `cost-${suffix}`;
    const seamA = asSeam(instanceA);

    const first = await consumeWithClient(
      seamA,
      { userId },
      COST_APPROVE,
      { windowSeconds: 30, userMax: 999, sourcingUserMax: 20 },
    );
    const second = await consumeWithClient(
      seamA,
      { userId },
      COST_APPROVE,
      { windowSeconds: 30, userMax: 999, sourcingUserMax: 20 },
    );
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    // 20 ≤ 20 : autorisé ; 30 > 20 : refus sur le bucket sourcing.
    const third = await consumeWithClient(
      seamA,
      { userId },
      COST_APPROVE,
      { windowSeconds: 30, userMax: 999, sourcingUserMax: 20 },
    );
    expect(third.allowed).toBe(false);
    expect(third.failingBucket).toBe('sourcing');
  });

  it('fenêtre expirée : le budget est de nouveau disponible sur B', async () => {
    const userId = `window-${suffix}`;
    const seamA = asSeam(instanceA);
    const seamB = asSeam(instanceB);

    for (let i = 0; i < 2; i += 1) {
      const decision = await consumeWithClient(
        seamA,
        { userId },
        1,
        { windowSeconds: 2, userMax: 2, sourcingUserMax: 999 },
      );
      expect(decision.allowed).toBe(true);
    }
    const refused = await consumeWithClient(
      seamB,
      { userId },
      1,
      { windowSeconds: 2, userMax: 2, sourcingUserMax: 999 },
    );
    expect(refused.allowed).toBe(false);

    // Attendre la VRAIE expiration Redis (poll de l'état, pas un sleep fixe —
    // robuste même machine lente). Fenêtre 2 s → disparition sous ~5 s.
    const deadline = Date.now() + 5_000;
    while ((await instanceA.exists(`rate:user:${userId}`)) === 1) {
      if (Date.now() > deadline) throw new Error('Le compteur Redis n’a pas expiré');
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    const afterWindow = await consumeWithClient(
      seamB,
      { userId },
      1,
      { windowSeconds: 2, userMax: 2, sourcingUserMax: 999 },
    );
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.source).toBe('redis');
  });

  it('le script Lua réel est celui exporté (conformance du seam)', () => {
    expect(RATE_LIMIT_LUA).toContain('INCRBY');
    expect(RATE_LIMIT_LUA).toContain('DECRBY');
    expect(RATE_LIMIT_LUA).toContain('EXPIRE');
  });
});
