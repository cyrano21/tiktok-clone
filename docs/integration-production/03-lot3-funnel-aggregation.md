# 03 — Lot 3 : ORKY devient Demand Intelligence Engine (agrégation d'entonnoir)

> PLAN-ORCHIDS — Lot 3, terminé côté ORKY le 2026-09-03.
> Objectif : transformer la télémétrie du Lot 2 en signal COMMERCE agrégé,
> joint au signal viral et envoyé à Pro avec la demande de sourcing.

## Ce qui existait

- Lot 2 : les `AnalyticsEvent` (milestones vidéo + événements produit) sont
  stockés dans le backend ORKY — source de vérité brute.
- `trendService.sendToSourcing()` envoyait le signal viral vers Pro via le
  proxy (`/api/trends/sourcing/requests`) — aucune donnée commerce dedans.

## Ce qui a été ajouté

### Backend — agrégation déterministe (`backend/src/services/analyticsAggregation.ts`)

- `foldWatchAggregate(videoId, rows)` — **pur** :
  - la complétion d'une session = milestone maximal atteint
    (completed = 1.0, 75 % = 0.75, …) ; la moyenne est par **session**, pas
    par événement → aucune inflation par le nombre d'événements ;
  - `sessionsStarted` = sessions distinctes (jamais le nombre d'événements) ;
  - `watchCompletionRate` (0..1) ou `null` sans session.
- `foldProductFunnelCounts` / `foldProductFunnel` — entonnoir produit pur :
  impressions, clicks, detailViews, addToCarts, removeFromCarts,
  checkoutHandoffs, checkoutsStarted, checkoutsCancelled, paid.
- `aggregateWatch(videoId)` / `aggregateProductFunnel(productId)` — requêtes
  Prisma sur 90 jours (fenêtre configurable), aucune table d'agrégat : les
  AnalyticsEvent restent la vérité, les compteurs sont toujours frais.

### Backend — `GET /v1/telemetry/funnel`

- `backend/src/routes/telemetry.routes.ts` : `?videoId=` et/ou `?productId=`
  (l'un des deux requis), `windowDays` optionnel (1..365).
- Réponse `{ video: WatchAggregate|null, product: ProductFunnelAggregate|null }`
  (`null` quand aucune activité — pas de faux zéros).

### Frontend — jointure au signal viral (`src/services/commerceStats.ts` + `trendService.ts`)

- `videoIdFromSignal(id)` — extrait l'id vidéo d'un signal scraper (`trend-…`).
- `toCommerceStats(funnel)` — mappe l'agrégat vers `commerceStats`
  (`{ videoId, watchSessions, watchCompletionRate, aggregatedAt }`) ;
  `undefined` sans donnée → le signal part **sans** commerceStats
  (rétro-compatible, champ optionnel du schéma V1).
- `trendService.sendToSourcing()` appelle `attachCommerceStats()` avant l'envoi
  (GET `/telemetry/funnel?videoId=…`, timeout 4 s) ; **toute erreur réseau est
  silencieuse** — le sourcing ne doit jamais être bloqué par l'analytics.

## Preuves exécutées

```text
backend: npx jest src/services/analyticsAggregation.test.ts src/routes/telemetry.routes.test.ts
→ Test Suites: 2 passed — Tests: 16 passed
  (9 folds purs + 3 tests GET /funnel + 6 tests POST /batch existants)

frontend: npm test -- --runInBand __tests__/commerce-stats.test.ts
→ 7 passed

npm run typecheck → exit 0
npm test (suite complète) → Test Suites: 31 passed — Tests: 105 passed
```

## Limites / travail restant

- Le **déclencheur périodique** du push produit (funnel par `productId` vers
  Pro, au-delà du champ `commerceStats` du signal) n'est pas encore câblé :
  aujourd'hui le signal commerce voyage avec la création de requête de
  sourcing. Un envoi programmé (batch quotidien / post-flush) est la suite
  naturelle du Lot 6.
- Le funnel produit n'est pas encore exposé dans l'UI ORKY (l'endpoint
  `GET /v1/telemetry/funnel?productId=` existe et est testé).