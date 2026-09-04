# 02 — Lot 2 : Télémétrie ORKY (événements vidéo + commerce)

> PLAN-ORCHIDS — Lot 2, terminé côté ORKY le 2026-09-03.
> Objectif : fermer la boucle vidéo → signal commercial sans requête par frame.

## Ce qui existait

- `POST /v1/videos/:id/view` (backend) enregistrait `VideoView` (watchDuration,
  watchPercentage, fromSource) et alimentait le moteur de recommandation.
- Aucun pipeline d'événements par milestones ; la progression servait surtout à l'UI du player.

## Ce qui a été ajouté

### Backend (`backend/`)

- Modèle Prisma **`AnalyticsEvent`** (sessionId, eventId unique, type, videoId?, productId?,
  userId?, payload Json?, createdAt) + relation User. `prisma generate` OK ;
  **migration DB non appliquée** (nécessite un `DATABASE_URL` réel — à faire au déploiement).
- **`POST /v1/telemetry/batch`** (`backend/src/routes/telemetry.routes.ts`, enregistré dans
  `routes/index.ts`) :
  - zod : `{ sessionId, events[1..100] }`, 19 types d'événements (enum) ;
  - dédup par `eventId` dans le lot ET contre la base (idempotence inter-batch) ;
  - réponse `{ accepted, duplicates }`.

### Frontend (`src/`)

- **`src/services/telemetry.ts`** — client zéro-dépendance au chargement :
  - buffer + flush (taille ≥ 20 ou 5 s) ; flush sur `pagehide` / perte de visibilité ;
  - `eventId` unique + `sessionId` par session → jamais de double comptage côté serveur ;
  - `createWatchTracker()` (pur) : `video_started`, `video_25/50/75_percent`,
    `video_completed`, `video_replayed` (détection de boucle repeat), un seul événement par milestone ;
  - transport injectable (`setTelemetryTransport`) pour les tests.
- **`FeedItem.tsx`** : impression par entrée dans le viewport ; milestones depuis `onProgress` ;
  `video_shared` / `video_saved` / `creator_followed` ; `product_clicked` +
  `product_detail_viewed` sur les piliers produit.
- **`cartStore.ts`** : `add_to_cart` / `remove_from_cart` / `checkout_handoff_created` /
  `checkout_paid` / `checkout_cancelled` sur le cycle panier → handoff → paiement.

## Vérifications exécutées

| Vérification | Commande | Résultat |
|---|---|---|
| Backend route (6 tests) | `cd backend && npm test -- telemetry.routes.test.ts --runInBand` | ✅ 6/6 — gate 83 % : 4 milestones acceptés, rejeu = 0 accepté / 4 doublons, types inconnus 400 |
| Frontend tracker/client (8 tests) | `npm test -- __tests__/telemetry.test.ts --runInBand` | ✅ 8/8 — lecture 83 % → `[started, 25, 50, 75]` une seule fois, completed unique, replay, flush unique |
| Régression UI/cart/bridge (5 suites) | `npm test -- __tests__/{cart-handoff-reconciliation,orchidy-bridge,explore-navigation,explore-child-layout,app-layout}` | ✅ 14/14 |
| Typecheck frontend | `npm run typecheck` | ✅ exit 0 |
| Typecheck backend (via ts-jest) | inclus dans les tests ci-dessus | ✅ |

## Gate Lot 2

> « Lecture vidéo 83 % → le backend reçoit une seule télémétrie correcte → aucun double comptage. »

Couvert par :
- `__tests__/telemetry.test.ts` (émission côté client : exactement un événement par milestone) ;
- `backend/src/routes/telemetry.routes.test.ts` (réception côté serveur : 4 événements acceptés
  une seule fois, rejeu d'un même `eventId` jamais re-inséré).

## Restant / dépendances

- Appliquer la migration Prisma `AnalyticsEvent` (db push / migrate) sur la vraie base.
- `checkout_started` non émis séparément (le handoff créé en tient lieu) ; rattacher si besoin
  à l'écran panier au Lot 6.
- **Lot 3** : connecter ces événements à Orchidy Pro (signal commercial + Commercial Opportunity Score).
- Lot 4 : le rate limiting mémoire du proxy ORKY→Pro passe sur Redis (indépendant).
