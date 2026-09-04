import {
  COST_APPROVE,
  COST_CREATE,
  COST_GENERATE_VIDEO,
  COST_GET,
  RATE_LIMIT_LUA,
  consumeRate,
  consumeWithClient,
  costForOperation,
} from '../src/lib/rateLimit/redisRateLimiter';

/**
 * Faux client Redis partageant UNE SEULE source de vérité (store + horloge) :
 * reproduit le contrat du script Lua (INCRBY/EXPIRE/TTL/DECRBY/DEL, fenêtre
 * fixe, rollback all-or-nothing). Deux « instances » qui passent par le même
 * client partagent exactement le même compteur — c'est le Gate Lot 4.
 */
class FakeRedis {
  private store = new Map<string, { count: number; expiresAt: number }>();
  private clock = Date.now();

  setTime(ms: number) {
    this.clock = ms;
  }

  advance(ms: number) {
    this.clock += ms;
  }

  countOf(key: string): number {
    return this.store.get(key)?.count ?? 0;
  }

  async eval(_script: string, options: { keys: string[]; arguments: Array<string | number> }) {
    const keys = options.keys;
    const cost = Number(options.arguments[0]);
    const windowSeconds = Number(options.arguments[1]);
    const maxes = options.arguments.slice(2).map(Number);

    // Nettoyage des fenêtres expirées.
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= this.clock) this.store.delete(key);
    }

    const buckets = keys.map((key, index) => ({ key, max: maxes[index] }));
    let failing = -1;
    let failingTtl = 0;

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      const existing = this.store.get(bucket.key);
      if (existing) {
        existing.count += cost;
      } else {
        this.store.set(bucket.key, { count: cost, expiresAt: this.clock + windowSeconds * 1000 });
      }
      if (this.store.get(bucket.key)!.count > bucket.max) {
        failing = i;
        failingTtl = Math.max(1, Math.ceil((this.store.get(bucket.key)!.expiresAt - this.clock) / 1000));
        break;
      }
    }

    if (failing >= 0) {
      // Rollback all-or-nothing (contrat du script Lua).
      for (let i = 0; i <= failing; i++) {
        const entry = this.store.get(buckets[i].key)!;
        entry.count -= cost;
        if (entry.count <= 0) this.store.delete(buckets[i].key);
      }
      return [0, failing + 1, failingTtl];
    }
    return [1, 0, 0];
  }
}

describe('Lot 4 — Gate : deux instances partagent exactement le même compteur', () => {
  const options = { windowSeconds: 60, userMax: 10, ipMax: 100, sourcingUserMax: 40 };

  it('l’instance B voit immédiatement le budget consommé par l’instance A', async () => {
    const shared = new FakeRedis();

    // Instance A : brûle tout le budget utilisateur (10 × coût 1).
    for (let i = 0; i < 10; i++) {
      const decision = await consumeWithClient(shared, { userId: 'u1', ip: '1.2.3.4' }, 1, options);
      expect(decision.allowed).toBe(true);
    }

    // Instance B (même client partagé) : refus immédiat, retry-after > 0.
    const blocked = await consumeWithClient(shared, { userId: 'u1', ip: '9.9.9.9' }, 1, options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.source).toBe('redis');
    expect(shared.countOf('rate:user:u1')).toBe(10);

    // Fenêtre expirée (horloge partagée) → l'instance B repasse.
    shared.advance(61_000);
    const afterWindow = await consumeWithClient(shared, { userId: 'u1', ip: '9.9.9.9' }, 1, options);
    expect(afterWindow.allowed).toBe(true);
    expect(shared.countOf('rate:user:u1')).toBe(1);
  });

  it('le compteur de l’instance A inclut ce que l’instance B a déjà consommé', async () => {
    const shared = new FakeRedis();

    await consumeWithClient(shared, { userId: 'u1', ip: 'ip-a' }, 1, options);
    await consumeWithClient(shared, { userId: 'u1', ip: 'ip-b' }, 1, options);

    // A a consommé 1, B a consommé 1 : le 9e coût (budget 10) passe encore,
    // mais le 10e est refusé — le compteur est bien partagé.
    for (let i = 0; i < 8; i++) {
      const decision = await consumeWithClient(shared, { userId: 'u1', ip: 'ip-a' }, 1, options);
      expect(decision.allowed).toBe(true);
    }
    const blocked = await consumeWithClient(shared, { userId: 'u1', ip: 'ip-b' }, 1, options);
    expect(blocked.allowed).toBe(false);
  });
});

describe('Lot 4 — coûts pondérés par opération', () => {
  const options = { windowSeconds: 60, userMax: 60, ipMax: 200, sourcingUserMax: 40 };

  it('generate-video (20) + 4× create (5×4) = 40 → un GET de plus est refusé sur le bucket sourcing', async () => {
    const shared = new FakeRedis();

    const video = await consumeWithClient(shared, { userId: 'u1', ip: 'ip' }, COST_GENERATE_VIDEO, options);
    expect(video.allowed).toBe(true);

    for (let i = 0; i < 4; i++) {
      const create = await consumeWithClient(shared, { userId: 'u1', ip: 'ip' }, COST_CREATE, options);
      expect(create.allowed).toBe(true);
    }

    // Bucket sourcing à 40/40 : le coût 1 du GET dépasse.
    const blocked = await consumeWithClient(shared, { userId: 'u1', ip: 'ip' }, COST_GET, options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.failingBucket).toBe('sourcing');
    // Rollback : le bucket utilisateur n'a PAS été incrémenté par la demande refusée.
    expect(shared.countOf('rate:user:u1')).toBe(40);
    expect(shared.countOf('rate:sourcing:u1')).toBe(40);
  });

  it('rollback all-or-nothing : un coût trop lourd n’entame aucun bucket', async () => {
    const shared = new FakeRedis();
    const tight = { windowSeconds: 60, userMax: 5, ipMax: 100, sourcingUserMax: 40 };

    await consumeWithClient(shared, { userId: 'u1', ip: 'ip' }, 4, tight); // user à 4/5
    const heavy = await consumeWithClient(shared, { userId: 'u1', ip: 'ip' }, 20, tight);
    expect(heavy.allowed).toBe(false);
    expect(heavy.failingBucket).toBe('user');
    // La demande refusée n'a rien incrémenté : chaque bucket reste à 4
    // (la valeur laissée par la seule demande acceptée, coût 4).
    expect(shared.countOf('rate:user:u1')).toBe(4);
    expect(shared.countOf('rate:sourcing:u1')).toBe(4);
    expect(shared.countOf('rate:ip:ip')).toBe(4);
  });
});

describe('Lot 4 — mapping coût (méthode, chemin)', () => {
  it('GET = 1, create = 5, approve = 10, generate-video = 20', () => {
    expect(costForOperation('GET', ['requests'])).toBe(1);
    expect(costForOperation('GET', ['requests', 'abc123def456ghi789'])).toBe(1);
    expect(costForOperation('POST', ['requests'])).toBe(5);
    expect(costForOperation('POST', ['requests', 'abc123def456ghi789', 'approve'])).toBe(10);
    expect(costForOperation('POST', ['requests', 'abc123def456ghi789', 'generate-video'])).toBe(20);
    expect(costForOperation('POST', ['unknown'])).toBe(1);
  });
});

describe('Lot 4 — repli mémoire (pas de Redis) et contrat Lua', () => {
  it('sans client Redis : comportement legacy mono-instance', async () => {
    // Fenêtre fixe : consommer exactement `max` passe, dépasser bloque.
    const first = await consumeWithClient(null, { userId: 'u1', ip: 'ip' }, 1, {
      windowSeconds: 60,
      userMax: 1,
      ipMax: 1,
      sourcingUserMax: 1,
    });
    expect(first.allowed).toBe(true);
    expect(first.source).toBe('memory');

    const blocked = await consumeWithClient(null, { userId: 'u1', ip: 'ip' }, 1, {
      windowSeconds: 60,
      userMax: 1,
      ipMax: 1,
      sourcingUserMax: 1,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('le script Lua garde les invariants atomiques (INCRBY+EXPIRE, rollback DECRBY)', () => {
    expect(RATE_LIMIT_LUA).toContain('INCRBY');
    expect(RATE_LIMIT_LUA).toContain('EXPIRE');
    expect(RATE_LIMIT_LUA).toContain('DECRBY');
    expect(RATE_LIMIT_LUA).toContain('TTL');
    expect(RATE_LIMIT_LUA).toContain('DEL');
  });

  it('la façade production expose consumeRate', () => {
    expect(typeof consumeRate).toBe('function');
  });
});