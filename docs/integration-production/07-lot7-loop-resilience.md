# 07 — Lot 7 : Résilience de la boucle AI Dropshipping (côté ORKY)

> PLAN-ORCHIDS — Lot 7, terminé côté ORKY le 2026-09-03.
> Objectif : une panne transitoire ne crée jamais deux vidéos, ne perd ni ne
> double aucune vente.

## Rôle d'ORKY dans la boucle (étapes 9-16)

```text
Pro génère une vidéo (jobId stable par requête)
   → POST /api/trends/generated-video/import   (Next, proxy)
      → POST /v1/commerce-imports/generated-video  (backend Fastify)
         externalContentId = jobId Pro
         → 1 Video (ou la même, idempotente)
         → videoProductMatch → produit Orchidy
   → POST /api/integrations/orky/viral-sourcing/{id}/video-link (Pro)
```

Le proxy Next (route d'import) est lui-même idempotent : si
`generatedVideo.orkyVideoId` existe déjà côté Pro, il renvoie la vidéo
existante sans rien créer. Si le lien Pro échoue après l'import orky, la
réponse est `recoverable: true` — un retry répare le lien **sans** produire
une seconde vidéo.

## Surfaces prouvées (backend)

### `backend/src/routes/commerce-import.routes.lot7.test.ts` (5/5 ✅)

Mocks prisma + catalogue + média (mêmes conventions que
`telemetry.routes.test.ts`), Fastify `inject` sur la vraie route :

1. **Import initial** → 201, 1 `video.create`, 1 `user.update`, 1 match.
2. **Double import / retry après panne du lien Pro** → second POST `200
   idempotent:true` avec la même `videoId`, **`video.create` appelé une seule
   fois au total**, le replay upsert le product-match existant et ne re-ingère
   pas le média.
3. **Course de deux workers / restart** → les deux passent le pre-check
   (`findFirst` null), le perdant frappe la contrainte
   `@@unique([externalPlatform, externalContentId])` (P2002) au commit : le
   média téléversé est nettoyé (`deleteMediaObjects`), et la réponse renvoie
   le **gagnant** (`idempotent:true`) — jamais une seconde vidéo.
4. **Produit Orchidy indisponible** → 422, aucun appel d'import (le catalogue
   est validé avant toute création).
5. **Secret interne manquant** → 403, zéro effet de bord.

Ces invariants s'appuient sur le schéma : `@@unique([externalPlatform,
externalContentId])` sur `Video` (`backend/prisma/schema.prisma`) + pre-check
`findFirst` + réconciliation P2002 dans la route.

## Matrice de pannes (Gate Lot 7)

| Panne | Où est prouvée l'invariant | Résultat |
|-------|---------------------------|----------|
| Pro indisponible | route d'import orky → 502/409, aucun état orky créé | retryable |
| ORKY indisponible | pas de livraison → Pro retente (jobId stable) | retryable |
| Orchidy indisponible | import refusé 422 avant création vidéo | aucune vidéo orpheline |
| timeout réseau | `withTimeout` 20 s média / 180 s import → erreur, rien de créé | retryable |
| **double webhook** | test #2 + test claim Pro (lot 7 pro) | 1 vidéo, 1 conversion |
| **double worker** | test #3 (P2002 → gagnant) + claim Pro `processing` | 1 vidéo, 1 traitement |
| **restart après paiement** | claim Pro (lease → reclaim) + `recordConversion` atomique | vente non perdue, 1 conversion |
| **restart pendant génération vidéo** | Pro : gate de statut `queueViralSourcingVideo` (1 jobId/requête) | 1 vidéo |

## Exécution

- `cd backend && npx jest src/routes/commerce-import.routes.lot7.test.ts` →
  5/5 ✅ (exit 0).
- Typecheck backend : la suite est compilée par ts-jest (types validés).
- Docs miroir côté Pro : `orchidy-pro/docs/integration-production/07-lot7-loop-resilience.md`.

## NOT_RUN / NON VÉRIFIÉ

- E2E réel trois apps (aucun déploiement local) : la chaîne est prouvée
  surface par surface + par les lots précédents (2 télémétrie, 3 funnel, 4
  Redis, 5 autorité, 6 protocole HMAC).
- Vraie base Postgres : la contrainte unique P2002 a été rejouée par mock ;
  un run contre Postgres réel est `NOT_RUN` ici.
- Multi-tab / double-return checkout : couverts par les bases
  `cart-handoff-reconciliation` existantes (non dupliqués).
