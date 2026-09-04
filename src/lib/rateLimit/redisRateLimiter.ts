/**
 * Rate limiting Redis ORKY→Pro — Lot 4 (PLAN-ORCHIDS).
 *
 * Remplace le `Map` en mémoire du proxy ORKY→Pro (chaque instance avait son
 * propre compteur) par des compteurs Redis partagés :
 *
 *   rate:user:{userId}      — budget global de l'utilisateur
 *   rate:ip:{ip}            — budget global de l'adresse IP
 *   rate:sourcing:{userId}  — budget de la route sourcing (par utilisateur)
 *
 * Coût par opération (fenêtre glissante fixe, TTL atomique) :
 *   GET sourcing           coût 1
 *   create sourcing        coût 5
 *   approve candidat       coût 10  (déclenche création produit + publication)
 *   generate video         coût 20
 *
 * Atomicité : le script Lua exécute incrément + TTL + rollback en un seul
 * bloc (Redis exécute les scripts atomiquement). La consommation est
 * all-or-nothing sur les trois buckets : si l'un d'eux est dépassé, aucun
 * bucket n'est incrémenté (rollback intégré au script).
 *
 * Sans Redis joignable (dev local sans serveur), repli en mémoire dans le
 * processus — le comportement legacy mono-instance est préservé, avec un
 * avertissement unique. Deux instances ne partagent le compteur QUE via Redis.
 */

import { createClient } from 'redis';

export const RATE_WINDOW_SECONDS = parseInt(process.env.ORKY_RATE_WINDOW_SECONDS || '60', 10) || 60;
export const RATE_USER_MAX = parseInt(process.env.ORKY_RATE_USER_MAX || '60', 10) || 60;
export const RATE_IP_MAX = parseInt(process.env.ORKY_RATE_IP_MAX || '120', 10) || 120;
export const RATE_SOURCING_USER_MAX = parseInt(process.env.ORKY_RATE_SOURCING_USER_MAX || '40', 10) || 40;

export const COST_GET = 1;
export const COST_CREATE = parseInt(process.env.ORKY_RATE_COST_CREATE || '5', 10) || 5;
export const COST_APPROVE = parseInt(process.env.ORKY_RATE_COST_APPROVE || '10', 10) || 10;
export const COST_GENERATE_VIDEO = parseInt(process.env.ORKY_RATE_COST_GENERATE_VIDEO || '20', 10) || 20;

/** Coût d'une opération selon (méthode, chemin) — reflet du plan Lot 4. */
export function costForOperation(method: string, pathSegments: string[]): number {
  if (method === 'GET') return COST_GET;
  const joined = pathSegments.join('/');
  if (joined === 'requests') return COST_CREATE;
  if (/^requests\/[A-Za-z0-9]{10,40}$/.test(joined)) return COST_GET;
  if (/^requests\/[A-Za-z0-9]{10,40}\/approve$/.test(joined)) return COST_APPROVE;
  if (/^requests\/[A-Za-z0-9]{10,40}\/generate-video$/.test(joined)) return COST_GENERATE_VIDEO;
  return COST_GET;
}

/** Script Lua : fenêtre fixe atomique, coût, TTL, rollback all-or-nothing. */
export const RATE_LIMIT_LUA = `
local cost = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local n = #KEYS
for i = 1, n do
  local key = KEYS[i]
  local max = tonumber(ARGV[2 + i])
  local existed = redis.call('EXISTS', key)
  local count = redis.call('INCRBY', key, cost)
  if existed == 0 then
    redis.call('EXPIRE', key, window)
  end
  if count > max then
    for j = 1, i do
      local c = redis.call('DECRBY', KEYS[j], cost)
      if c <= 0 then
        redis.call('DEL', KEYS[j])
      end
    end
    local ttl = redis.call('TTL', key)
    return { 0, i, ttl }
  end
end
return { 1, 0, 0 }
`;

export interface RateBuckets {
  userId?: string;
  ip?: string;
}

export interface RateDecision {
  allowed: boolean;
  /** Secondes avant la prochaine fenêtre (bucket défaillant). */
  retryAfter: number;
  /** Nom du bucket défaillant ('user' | 'ip' | 'sourcing'), si refus. */
  failingBucket?: string;
  source: 'redis' | 'memory';
}

export interface RateLimitClient {
  eval(script: string, options: { keys: string[]; arguments: Array<string | number> }): Promise<unknown>;
}

/** Repli mémoire : un compteur par bucket, fenêtre fixe, même sémantique. */
class MemoryFallback {
  private counts = new Map<string, { count: number; resetAt: number }>();

  consume(key: string, cost: number, max: number): { allowed: boolean; retryAfter: number } {
    const now = Date.now();
    const current = this.counts.get(key);
    if (!current || current.resetAt <= now) {
      this.counts.set(key, { count: cost, resetAt: now + RATE_WINDOW_SECONDS * 1000 });
      return { allowed: cost <= max, retryAfter: 0 };
    }
    current.count += cost;
    if (current.count > max) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
    }
    return { allowed: true, retryAfter: 0 };
  }
}

const memoryFallback = new MemoryFallback();

type OrkyRedisClient = ReturnType<typeof createClient>;

function redisClient(): OrkyRedisClient {
  const globalStore = globalThis as unknown as { __orkyRateLimitClient?: OrkyRedisClient };
  if (!globalStore.__orkyRateLimitClient) {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: { connectTimeout: 2000, reconnectStrategy: false },
    });
    client.on('error', () => {
      /* Les échecs sont gérés à la consommation (repli mémoire). */
    });
    globalStore.__orkyRateLimitClient = client;
  }
  // ensureConnected() ne renvoie true qu'après connexion : le client existe ici.
  return globalStore.__orkyRateLimitClient!;
}

let connected = false;
let nextConnectAttemptAt = 0;
let warnedMemoryFallback = false;
const CONNECT_RETRY_MS = 30_000;

async function ensureConnected(): Promise<boolean> {
  if (connected) return true;
  const now = Date.now();
  if (now < nextConnectAttemptAt) return false;
  const client = redisClient();
  try {
    await client.connect();
    connected = true;
  } catch {
    connected = false;
    // Ne pas marteler Redis toutes les requêtes en cas de panne : on retente
    // toutes les 30 s, et on reste en repli mémoire entre-temps.
    nextConnectAttemptAt = Date.now() + CONNECT_RETRY_MS;
  }
  return connected;
}

function warnFallbackOnce(): void {
  if (warnedMemoryFallback) return;
  warnedMemoryFallback = true;
  console.warn(
    '[rate-limit] Redis indisponible — repli mémoire mono-instance. ' +
      'Deux instances ORKY ne partageront PAS leur compteur tant que REDIS_URL n’est pas joignable.',
  );
}

function bucketKey(kind: 'user' | 'ip' | 'sourcing', value: string): string {
  return `rate:${kind}:${value}`;
}

export interface RateLimitOptions {
  windowSeconds?: number;
  userMax?: number;
  ipMax?: number;
  sourcingUserMax?: number;
}

function buildBuckets(
  buckets: RateBuckets,
  options: RateLimitOptions,
): { keys: string[]; maxes: number[]; keyToBucket: Map<string, string>; windowSeconds: number } {
  const windowSeconds = options.windowSeconds ?? RATE_WINDOW_SECONDS;
  const userMax = options.userMax ?? RATE_USER_MAX;
  const ipMax = options.ipMax ?? RATE_IP_MAX;
  const sourcingUserMax = options.sourcingUserMax ?? RATE_SOURCING_USER_MAX;

  const keys: string[] = [];
  const maxes: number[] = [];
  const keyToBucket = new Map<string, string>();
  if (buckets.userId) {
    keys.push(bucketKey('user', buckets.userId));
    maxes.push(userMax);
    keyToBucket.set(bucketKey('user', buckets.userId), 'user');
    keys.push(bucketKey('sourcing', buckets.userId));
    maxes.push(sourcingUserMax);
    keyToBucket.set(bucketKey('sourcing', buckets.userId), 'sourcing');
  }
  if (buckets.ip) {
    keys.push(bucketKey('ip', buckets.ip));
    maxes.push(ipMax);
    keyToBucket.set(bucketKey('ip', buckets.ip), 'ip');
  }
  return { keys, maxes, keyToBucket, windowSeconds };
}

function parseEvalResult(result: unknown, windowSeconds: number): { allowed: boolean; failingIndex: number; ttl: number } {
  if (Array.isArray(result) && Number(result[0]) === 1) {
    return { allowed: true, failingIndex: 0, ttl: 0 };
  }
  const failingIndex = Array.isArray(result) ? Number(result[1]) : 1;
  const ttl = Array.isArray(result) ? Number(result[2]) : windowSeconds;
  return { allowed: false, failingIndex: Math.max(1, failingIndex), ttl: ttl > 0 ? ttl : windowSeconds };
}

/**
 * Cœur testable : consomme `cost` via un client Redis injecté (le même client
 * partagé entre deux « instances » = le même compteur, Gate Lot 4).
 */
export async function consumeWithClient(
  client: RateLimitClient | null,
  buckets: RateBuckets,
  cost: number,
  options: RateLimitOptions = {},
): Promise<RateDecision> {
  const { keys, maxes, keyToBucket, windowSeconds } = buildBuckets(buckets, options);
  if (keys.length === 0) {
    return { allowed: true, retryAfter: 0, source: 'memory' };
  }

  if (client) {
    try {
      const result = await client.eval(RATE_LIMIT_LUA, {
        keys,
        arguments: [cost, windowSeconds, ...maxes],
      });
      const parsed = parseEvalResult(result, windowSeconds);
      if (parsed.allowed) return { allowed: true, retryAfter: 0, source: 'redis' };
      const failingKey = keys[parsed.failingIndex - 1];
      return {
        allowed: false,
        retryAfter: parsed.ttl,
        failingBucket: failingKey ? keyToBucket.get(failingKey) : undefined,
        source: 'redis',
      };
    } catch {
      // Chute dans le repli mémoire (comportement documenté).
    }
  }

  // Repli mémoire : les buckets sont consommés individuellement (comportement
  // legacy mono-instance, aucune garantie de partage inter-instances).
  const decisions = keys.map((key, index) => memoryFallback.consume(key, cost, maxes[index]));
  const failing = decisions.findIndex((decision) => !decision.allowed);
  if (failing >= 0) {
    const failingKey = keys[failing];
    return {
      allowed: false,
      retryAfter: Math.max(1, decisions[failing].retryAfter),
      failingBucket: failingKey ? keyToBucket.get(failingKey) : undefined,
      source: 'memory',
    };
  }
  return { allowed: true, retryAfter: 0, source: 'memory' };
}

/**
 * Consomme `cost` sur les buckets demandés (client Redis singleton de
 * production, avec repli mémoire). Tous les buckets doivent passer ; sinon
 * 429 avec le TTL du bucket défaillant, et aucun bucket n'est entamé.
 */
/** Adaptateur vers la signature `eval` réelle du client redis (overloads). */
function productionClient(): RateLimitClient {
  const client = redisClient();
  // Le client redis expose plusieurs overloads d'`eval` ; on le ramène à la
  // signature étroite du seam (script + keys + arguments) utilisée partout.
  // IMPORTANT (Lot 4, découvert par le test live) : sans ces deux
  // adaptations, l'eval échouait et le limiter retombait silencieusement en
  // mémoire (source 'memory' dans toutes les réponses) :
  //  1. node-redis rejette les `arguments` numériques
  //     (« Invalid argument type ») — il exige des chaînes ;
  //  2. appeler `client.eval(...)` sans son récepteur casse les champs
  //     privés de la classe (« Cannot read private member ... ») — il faut
  //     `.bind(client)` avant de passer par le seam.
  const evalFn = (client.eval as unknown as (
    script: string,
    options: { keys: string[]; arguments: Array<string | number> },
  ) => Promise<unknown>).bind(client);
  return {
    eval: (script, options) =>
      evalFn(script, {
        keys: options.keys,
        arguments: options.arguments.map((value) => String(value)),
      }),
  };
}

export async function consumeRate(
  buckets: RateBuckets,
  cost: number,
  options: RateLimitOptions = {},
): Promise<RateDecision> {
  const client = (await ensureConnected()) ? productionClient() : null;
  if (!client) warnFallbackOnce();
  return consumeWithClient(client, buckets, cost, options);
}