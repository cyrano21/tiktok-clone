# HANDOFF — ORKY (repo `tiktok-clone`) — 2026-09-04

> **À l'agent qui reprend ici (autre machine)** : ce document est ton point d'entrée.
> Il décrit l'état réel du dépôt, les preuves déjà exécutées, ce qui reste **NOT RUN**,
> et les corrections/étapes suivantes. Ne fais confiance à aucun statut sans l'avoir
> rejoué — les commandes de vérification sont en §6.

---

## 1. Contexte mission : PLAN-ORCHIDS

Projet en 3 dépôts (sources du plan : `D:\telechargements\PLAN-ORCHIDS.txt`) :

| Repo | Rôle | Stack |
|---|---|---|
| **ORKY** (ce repo, dossier local `D:\Projets\tiktok-clone`) | Détection de tendances (TikTok), télémétrie commerce, checkout sécurisé vers Orchidy | Next 14, React Native (mobile), backend Express + Prisma, Jest |
| `orchidy` | Marketplace / storefront + fulfillment réel (fournisseurs) | Next.js, Mongoose, Vitest |
| `orchidy-pro` | Sourcing viral IA, scoring d'opportunité, publication vers Orchidy | Next.js, Prisma/MongoDB, pnpm, Vitest |

Git remote de ce repo : voir `git remote -v`. Branche de travail : **`main`**.

## 2. État git

- Dernier commit poussé sur `origin/main` : **`dda6d73`** — `feat(integration): ORKY commerce loop — telemetry, Redis limiter, secured checkout, correlationId` (56 fichiers, +10 669).
- Working tree supposé propre — vérifier avec `git status` avant tout.
- ⚠️ Le `package.json` a subi une réécriture de fins de ligne lors d'une installation ; le diff réel n'ajoutait que la dépendance `redis` (Lot 4). Si `git diff` paraît énorme, utiliser `git diff --ignore-cr-at-eol`.

## 3. Ce qui est implémenté et prouvé dans ce repo

| Lot | Contenu | Statut | Preuve |
|---|---|---|---|
| 1 | Contrats canoniques versionnés (`src/contracts/v1`, 10 schémas OrkyTrendSignalV1 → MarketplaceFulfillmentEventV1) | IMPLEMENTED + LOCAL_QA_PASS | tests consommateur verts |
| 2 | Télémétrie commerce (backend Express + Prisma : modèle VideoView, routes telemetry, agrégations funnel) | IMPLEMENTED + LOCAL_QA_PASS | suites backend vertes |
| 3 | Agrégation funnel + `GET /v1/telemetry/funnel` + scoring consommé côté Pro | IMPLEMENTED + LOCAL_QA_PASS | `analyticsAggregation.test.ts`, tests routes |
| 4 | Rate limiter **Redis** (remplace l'in-memory ; dépendance `redis` ajoutée) | IMPLEMENTED + LOCAL_QA_PASS | voir §6 ; la gate live a trouvé 2 bugs réels corrigés |
| 6 | Côté ORKY du protocole sécurisé ORKY→Orchidy (HMAC + timestamp + nonce, catalog validation, checkout) | IMPLEMENTED + LOCAL_QA_PASS | tests replay/falsification |
| 7 | Résilience boucle IA (restart video-gate, anti-doublon vidéo/webhook) | IMPLEMENTED + LOCAL_QA_PASS | gate restart 8/8 |
| 8 | Émission déterministe du `correlationId` (source → sourcing → checkout) | IMPLEMENTED + LOCAL_QA_PASS | suites télémétrie/checkout |

Docs détaillées par lot : `docs/integration-production/00…08-*.md` (lire `00-baseline.md` puis le lot concerné).

## 4. NOT RUN — à faire en premier sur la nouvelle machine

1. **`npm run build` (Next 14) : jamais terminé localement.** Le build a été tué en cours de
   compilation (machine trop lente, processus node à ~1,5 cœur pendant 10+ min). **C'est la
   première vérification attendue.** Si des erreurs apparaissent, elles sont *nouveilles* :
   corriger avant toute autre tâche.
2. La suite Jest complète (`npm test`) : la dernière exécution complète date d'avant le
   commit final ; rejouer au moins les suites `__tests__/rate-limiter*`, telemetry, checkout.
3. Aucun lint n'a été configuré dans ce repo (`next lint` demande un setup interactif) —
   décider : ajouter une config ESLint minimale ou ignorer (dette connue).

## 5. Travail restant (suite du plan)

Les lots 1→9 sont codés. Le **reste du plan est du déploiement/exploitation**, pas du code :

1. **Lot 6 (phase déploiement)** : faire tourner les 3 apps réellement connectées entre
   elles (ORKY → Orchidy en HTTP réel, secrets partagés dans les `.env` de prod) et rejouer
   les tests replay/falsification contre les services réels.
2. **Lot 9 (Phase D)** : monter le shadow mode en pourcentage puis basculer — la bascule se
   pilote côté orchidy-pro (voir son HANDOFF.md).
3. **Lot 7/9 exploitation** : brancher les alertes P0 (endpoint chez orchidy :
   `GET /api/internal/fulfillment-p0-alerts`) sur un canal de notification (cron + webhook).
4. Retour d'expérience : tout défaut humain récurrent constaté en prod → nouveau test de
   régression (convention du plan).

## 6. Comment vérifier (gates, commandes exactes)

```bash
npm install                      # si node_modules absent
npm test                         # suite complète Jest
npm test -- --runInBand __tests__/rate-limiter.test.ts   # limiter unitaire
npm run build                    # NOT RUN à ce jour — attendu en premier
```

**Gate live Redis (Lot 4)** — nécessite un Redis local :

```bash
# si docker dispo : docker run -p 6390:6379 redis
# sinon binaire portable (voir §7) :
cd D:\Projets\.tools\redis && ./redis-server.exe --port 6390 --bind 127.0.0.1 --save "" --appendonly no

cd tiktok-clone
REDIS_LIVE_TEST_URL=redis://127.0.0.1:6390 npx jest __tests__/rate-limiter.redis-live.test.ts
```

## 7. Environnement local de l'ancienne machine (reconstructible)

- `D:\Projets\.tools\redis\redis-server.exe` — Redis portable, port **6390** (loopback).
- `D:\Projets\.tools\mongodb\mongodb-win32-x86_64-windows-7.0.14\bin\mongod.exe` — MongoDB
  7.0.14 portable, port **27018**, dbpath `D:\Projets\.tools\mongo-data`.
- Ces binaires **ne sont pas commités** (hors repo). Sur la nouvelle machine : un Docker
  `redis` + `mongo:7` suffisent, en ajustant les variables ci-dessous.
- `.env` réels : fournis via `D:\telechargements\LES POINTS VENS` et déjà appliqués dans
  chaque repo — **ne jamais commiter de `.env`**.

## 8. Pièges connus

- **Machine d'origine très lente** : tout `next build`/grep repo-wide peut dépasser 10 min.
  Travailler avec des `find` ciblés et lancer les builds en tâche de fond avec logs
  (`npm run build > log 2>&1 &`), puis sonder le log.
- Orchidy (autre repo) : mocks qui interfèrent entre suites **en exécution jointe** (verts
  en isolé) — préexistant, non lié aux Lots 1-9.
- Ne pas committer `.kiro/settings/mcp.json` (bruit IDE, orchestré côté orchidy-pro).

## 9. Convention d'écriture des rapports

Chaque lot terminé → un doc `docs/integration-production/NN-lotN-*.md` avec : date, statut
exact (`IMPLEMENTED` / `LOCAL_QA_PASS` / `NOT_RUN` / `AGENT-REPORTED`), commandes de preuve
réellement exécutées et leurs résultats. Ne jamais écrire « validé » sans preuve rejouée.
