# 00 — Baseline Lot 0 — ORKY (social / vidéo / tendances — repo « tiktok-clone »)

> Établi le 2026-09-03 sur cette machine (Windows, D:\Projets\tiktok-clone).
> Note : le dépôt GitHub s'appelle `cyrano21/tiktok-clone`, mais `package.json` déclare
> `"name": "orky"` → c'est l'application ORKY du plan (social/vidéo, backend à `localhost:4000`).
> Source du plan : `PLAN-ORCHIDS` (9 lots inter-apps ORKY ↔ Orchidy Pro ↔ Orchidy).

## État Git

- Branche : `main`
- SHA : `38ecd5a` — Merge pull request #13 from cyrano21/agent/openmontage-production-planner-2026-08-19 (2026-08-20)
- Working tree : propre
- Clone : frais (créé le 2026-09-03), aucun historique local divergent

## Stack & versions

- `name`: orky — version 2.0.0
- Package manager : npm (lock `package-lock.json`) ; npm 11.6.2
- Node v24.13.0
- Next.js 14.2.15 (⚠️ version avec avis de sécurité « upgrade to a patched version » à la sortie npm)
  + compatibilité React Native web (react-native-web, mocks jest) ; backend Node dans `backend/` ;
  tests jest (ts-jest, jsdom) ; `next lint`.

## Install

- `npm install --legacy-peer-deps` : ✅ exit 0 (5 min). Le flag est obligatoire
  (conflit peer React Native / Next — README et DEPLOY.md le prescrivent aussi) ;
  sans lui : ERESOLVE. Dép. obsolète notée : `glob@10.5.0`.

## Gates

| Gate | Commande | Résultat |
|---|---|---|
| Install | `npm install --legacy-peer-deps` | ✅ exit 0 |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | ✅ exit 0 |
| Lint | `npm run lint` (`next lint`) | ❌ NON CONFIGURÉ — pas de config ESLint dans le dépôt ; `next lint` demande une initialisation interactive (Strict/Base/Cancel) |
| Tests | `npm test` (jest, hors `backend/` et `e2e/`) | ⚠️ 26 fichiers passés / 1 échec — 74 tests passés / 1 échec (75 tests), durée ~161 s |
| Build | `npm run build` | ✅ exit 0 (Next 14.2.15, 7 pages statiques) ; premier run > 600 s machine chargée, second run OK |

### Test rouge préexistant (timing)

- `__tests__/screens-data-interactions.test.tsx` — « content controls › reloads Discover cards from the
  backend when a category is selected » : `Exceeded timeout of 5000 ms` (le fichier entier met 80 s ;
  le test attend des cartes Discover après sélection de catégorie). Timing, pas une assertion logique.

## Variables nécessaires

- `.env.local` créé (2026-09-03) depuis `D:\telechargements\LES POINTS VENS\ORKY.env.local`,
  ignoré par git (`.env`, `.env.local`) :
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/v1` (backend ORKY local)
- Aucun autre secret requis pour les gates exécutées.

## Services externes / URLs inter-apps

- Backend ORKY local : `http://localhost:4000/v1`
- Handoff ORKY → Orchidy (checkout signé) et délégation ORKY → Orchidy Pro : testés unitairement
  (`orchidy-bridge.test.ts`, `cart-handoff-reconciliation.test.ts`, `openMontageExecutionContract.test.ts` — verts).
- Scraper/tendances : mocks en test (`scraperVideoMapping`, `scraperProxyHeaders`, `scraperFeedActivation` — verts).

## Prochaines étapes

1. Configurer ESLint (config manquante) pour débloquer le gate lint.
2. Rejouer `screens-data-interactions` isolément (timeout 5 s vs 80 s de suite).
3. Gate Lot 0 → Lot 1 (contrats inter-apps) après revue.
