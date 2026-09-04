# 04 — Lot 4 : Rate limiting Redis du proxy ORKY→Pro

> PLAN-ORCHIDS — Lot 4, terminé le 2026-09-03.
> Objectif : deux instances ORKY partagent exactement le même compteur.

## Ce qui existait

- `app/api/trends/sourcing/[...path]/route.ts` (proxy ORKY→Pro) gardait un
  **`Map` en mémoire** (`hits`), clé `userId:ip`, 20 requêtes / 60 s.
  Avec instances A/B/C, chaque instance avait son propre compteur — un
  contournement trivial du rate limit et des limites incohérentes.

## Ce qui a été ajouté

### `src/lib/rateLimit/redisRateLimiter.ts`

- Clés Redis (le plan) :
  - `rate:user:{userId}` — budget utilisateur (défaut 60 / 60 s) ;
  - `rate:ip:{ip}` — budget IP (défaut 120 / 60 s) ;
  - `rate:sourcing:{userId}` — budget route sourcing par utilisateur
    (défaut 40 / 60 s).
- **Coûts pondérés** (le plan + approve) :
  `GET = 1`, `create = 5`, `approve = 10` (déclenche création produit +
  publication), `generate-video = 20`. Surcomposables par env
  (`ORKY_RATE_COST_*`), bornes via `ORKY_RATE_*_MAX`, fenêtre via
  `ORKY_RATE_WINDOW_SECONDS`.
- **TTL atomique + rollback all-or-nothing** : un script Lua unique
  (INCRBY + EXPIRE + DECRBY + DEL) exécute la consommation sur les buckets ;
  si un bucket dépasse son max, la demande est refusée **sans entamer aucun
  bucket**. `retry-after` = TTL restant du bucket défaillant.
- **Repli mémoire** : sans `REDIS_URL` joignable, comportement legacy
  mono-instance avec un avertissement unique (dev local sans serveur Redis) ;
  reconnexion Redis toutes les 30 s (pas de martelage en cas de panne).
- Client Redis singleton sur `globalThis` (survit au HMR Next.js dev).

### Proxy (`app/api/trends/sourcing/[...path]/route.ts`)

- Le `Map` disparaît ; `consumeRate({ userId, ip }, costForOperation(method, path))`.
- La validation de chemin passe **avant** le rate limit (un chemin invalide ne
  brûle plus de budget ; avant, le 429 pouvait précéder le 404).
- Réponse 429 enrichie : `{ error, failingBucket }` + header `retry-after`.

### Dépendance

- `redis ^4.6.12` ajouté au `package.json` racine (même version que le
  backend), installé avec `npm install --legacy-peer-deps` (convention du repo).

## Gate Lot 4 — preuve exécutée

```text
npm test -- --runInBand __tests__/rate-limiter.test.ts
→ 8 passed

npm run typecheck → exit 0
npm test (suite complète) → Test Suites: 31 passed — Tests: 105 passed
```

Le test de gate simule **deux instances partageant un même client Redis**
(store + horloge communs, contrat du script Lua) :

1. l'instance A brûle tout le budget ; l'instance B est refusée immédiatement
   avec `retry-after > 0` et le compteur reste exactement à la valeur partagée ;
2. après expiration de la fenêtre (horloge partagée), B repasse ;
3. coûts pondérés : generate-video (20) + 4× create (5) = 40/40 sur le bucket
   sourcing → un GET de plus est refusé sur `failingBucket: 'sourcing'`,
   et le bucket utilisateur n'a pas été incrémenté par la demande refusée
   (rollback vérifié).

## Limites / notes d'exploitation

- **`NOT_RUN`** : aucun serveur Redis local sur cette machine → le script Lua
  n'a pas été exécuté contre un Redis réel. Le faux client de test reproduit
  le contrat du script (INCRBY/EXPIRE/TTL/DECRBY/DEL, rollback) ; le script
  lui-même est asserté sur ses invariants (présence des commandes atomiques).
- Production : définir `REDIS_URL` sur **chaque instance** Next.js (le backend
  ORKY utilise déjà la même variable, `redis://localhost:6379` par défaut).
- Le `Map` legacy disparaît : sans Redis configuré, chaque instance retombe en
  mémoire (limites par instance, pas partagées) — comportement explicitement
  signalé en log.

## Mise à jour — GATE contre un vrai redis-server (2026-09-03)

La limite précédente est levée : un Redis 5.0.14.1 portable tourne
localement (workspace `D:\Projets\.tools\redis`, port 6390, loopback, sans
persistance) et le gate a été exécuté en conditions réelles :

```bash
cd /cygdrive/d/Projets/.tools/redis && ./redis-server.exe --port 6390 --bind 127.0.0.1 --save "" --appendonly no
cd tiktok-clone && REDIS_LIVE_TEST_URL=redis://127.0.0.1:6390 npx jest __tests__/rate-limiter.redis-live.test.ts
```

**4/4 ✅** (`__tests__/rate-limiter.redis-live.test.ts`, skippé sans env) :

1. **Gate deux instances** : l'instance B (client redis distinct) voit
   exactement le compteur consommé par A — budget 6 épuisé par A, B refusé
   avec `failingBucket: user` + retry-after du TTL, et le refus n'incrémente
   rien (rollback all-or-nothing vérifié au compteur brut).
2. **Coûts pondérés** : approve (10) ×3 contre `sourcingUserMax: 20` → les
   deux premiers passent (20 ≤ 20), le troisième est refusé sur le bucket
   `sourcing`.
3. **Fenêtre expirée** : après expiration TTL réelle (poll Redis, pas un
   sleep fixe), le budget redevient disponible — preuve du partage serveur.
4. Conformance du script Lua exporté.

### Deux bugs réels découverts et corrigés (le faux client ne pouvait pas les voir)

Sans les deux adaptations ci-dessous, `consumeRate` retombait **silencieusement
en mémoire** (`source: 'memory'` dans toutes les décisions) — le rate limiting
Redis n'a jamais réellement engagé en production :

1. **`Invalid argument type`** — node-redis rejette les `arguments` numériques
   d'`eval` ; il exige des chaînes. Corrigé dans `productionClient()`
   (`.map(String)`) et dans le seam du test live.
2. **`Cannot read private member …`** — appeler `client.eval(...)` sans son
   récepteur casse les champs privés de la classe (Node moderne). Corrigé par
   `.bind(client)` dans `productionClient()`.

Régression : suite fake `__tests__/rate-limiter.test.ts` 8/8 ✅, typecheck
orky exit 0. Pour reproduire la preuve ailleurs : installer Redis (ou
`docker run -p 6390:6379 redis`) puis relancer la commande ci-dessus.