# 08 — Lot 8 : Observabilité inter-applications (émission ORKY)

> PLAN-ORCHIDS — Lot 8, côté ORKY le 2026-09-03.
> ORKY est le point d'entrée de la boucle : c'est lui qui émet le
> `correlationId` commun suivi par toutes les applications.

## Contrat

- `TrendSignal.correlationId` — optionnel côté type, **toujours émis** par
  `toTrendSignal` : `correlationId: \`corr-${id}\`` où `id` =
  `trend-${videoId}` (le même `sourceSignalId`).
- Déterministe par tendance : un retry (Pro down, timeout) après l'échec
  d'un envoi réutilise la même valeur — idempotence d'émission alignée sur la
  dédupe `requestedBy:sourceSignalId` de Pro.
- Voyage : dans le payload `signal` de `POST /api/viral-sourcing/requests`
  (via `sendToSourcing`) → Pro le whiteliste (`sanitizeSignal`), le persiste
  sur la requête (`viralSourcingRequests.correlationId`) et l'expose dans
  `mapRequest` et la trace.

## Ce qui a été ajouté

- `src/services/trendService.ts` : champ `correlationId` sur `TrendSignal` +
  émission dans `toTrendSignal` (aucun autre changement de comportement).

## Exécution

- `npm run typecheck` → exit 0.
- Le reste des preuves (persistance, `traceByOrder`, route
  `GET /api/viral-sourcing/trace/by-order/:orderId`) est documenté dans la
  doc miroir Pro (`orchidy-pro/docs/integration-production/08-lot8-correlation-trace.md`).

## NON VÉRIFIÉ / suite

- Propagation du même id dans le handoff ORKY → Orchidy (métadonnées de
  commande), le retour d'attribution et le fulfillment — pas encore plombé
  (détaillé dans la doc Pro).
- Dashboard inter-apps, alertes P0 et DLQ avec Replay : Lot 9 (déploiement).
