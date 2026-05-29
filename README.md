# 🎵 TikTok Clone — Full-Stack React Native + Fastify

Clone fonctionnel de TikTok avec feed vertical, création vidéo, messagerie, live streaming et algorithme de recommandation.

## 📁 Structure

```
tiktok-clone/
├── src/                   # React Native (frontend mobile)
│   ├── components/        # Core (VideoPlayer, FeedItem...) + Shared (BottomSheet)
│   ├── screens/           # auth, feed, explore, create, inbox, profile, live, call
│   ├── navigation/        # RootNavigator, MainTabNavigator
│   ├── hooks/             # useVideoFeed, useDoubleTap, useSwipeNavigation
│   ├── services/          # api.ts, feedService.ts
│   ├── store/             # Zustand feedStore
│   ├── theme/             # tokens, colors
│   └── types/             # TypeScript types
├── backend/               # Fastify + Prisma + Redis + S3
│   ├── src/
│   │   ├── config/        # database, redis, s3
│   │   ├── middleware/    # auth, rateLimiter, upload
│   │   ├── routes/        # 11 route files
│   │   ├── controllers/   # Auth controller
│   │   └── services/      # video, recommendation, notification
│   └── prisma/
├── __tests__/             # Unit tests
└── docker-compose.yml
```

## 🚀 Quick Start

### Avec Docker (recommandé)

```bash
docker compose up -d
```

L'API sera disponible sur `http://localhost:3000`.

### Sans Docker

**Backend :**
```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

**Frontend :**
```bash
npm install
npx expo start
```

## 🔌 API Endpoints

| Prefix | Module |
|--------|--------|
| `/v1/auth` | Authentification (register, login, refresh, logout) |
| `/v1/feed` | Feed principal (For You / Following) |
| `/v1/videos` | CRUD vidéos, upload |
| `/v1/users` | Profils, follow/unfollow |
| `/v1/comments` | Commentaires sur vidéos |
| `/v1/hashtags` | Hashtags, trending |
| `/v1/sounds` | Sons, trending |
| `/v1/search` | Recherche users/vidéos/hashtags |
| `/v1/messages` | Messagerie (WebSocket) |
| `/v1/live` | Live streaming (WebSocket) |
| `/v1/notifications` | Notifications push |
| `/v1/tiktok` | Intégration officielle TikTok (Login Kit + Content Posting API) |

## 🛠 Stack Technique

- **Frontend** : React Native 0.73, Reanimated 3, Zustand, React Navigation 6
- **Backend** : Fastify 4, Prisma 5, PostgreSQL 16, Redis 7
- **Stockage** : MinIO (S3-compatible)
- **Temps réel** : WebSockets (Fastify)
- **Auth** : JWT (access + refresh tokens)

## 📱 Fonctionnalités

- ✅ Feed vertical TikTok-like (For You + Following)
- ✅ Lecture vidéo avec double-tap like
- ✅ Création de vidéos (record, edit, publish)
- ✅ Recherche avec hashtags/sons/users
- ✅ Profil utilisateur avec grille
- ✅ Messagerie temps réel
- ✅ Live streaming
- ✅ Notifications push
- ✅ Algorithme de recommandation
- ✅ Upload S3 avec optimisation d'images
- ✅ Rate limiting
- ✅ Authentification JWT

## 🧪 Tests

```bash
npm test
```

## 🎵 Intégration TikTok officielle (Login Kit + Content Posting API)

L'intégration couvre **deux niveaux** de capacités TikTok, activés
automatiquement selon les **scopes réellement accordés** par le compte connecté :

| Niveau | Produit TikTok | Scopes | Ce que ça permet |
|--------|----------------|--------|------------------|
| **Login Kit** | Login Kit | `user.info.basic`, `video.list` | Connexion, lecture du profil, liste des vidéos de l'utilisateur |
| **Publication** | Content Posting API | `video.publish`, `video.upload` | Publication directe sur le profil + envoi en brouillon |

> **État de l'app « orchidy pro » (client key `awde225g7m6cz4up`)** : approuvée
> pour **Login Kit uniquement** (`user.info.basic` + `video.list`). La
> publication automatique nécessite d'ajouter le produit **Content Posting API**
> à l'app et de la faire approuver. Tant que ce n'est pas le cas, l'UI masque les
> boutons de publication directe et propose la publication manuelle — sans jamais
> prétendre publier.

### Ce qui est implémenté

- **OAuth TikTok** : `GET /v1/tiktok/authorize` → consentement → `GET /v1/tiktok/callback` (échange code → tokens, stockés par utilisateur, profil enrichi via `user.info.basic`).
- **Statut + capacités** : `GET /v1/tiktok/status` renvoie `configured`, `connected`, le compte, `requestedScopes` et `capabilities` (`canReadProfile` / `canListVideos` / `canPublish` / `canUploadDraft`).
- **Profil** : `GET /v1/tiktok/user-info` (scope `user.info.basic`).
- **Vidéos de l'utilisateur** : `GET /v1/tiktok/videos` (scope `video.list`). Surface UI dédiée : écran **« Mes vidéos TikTok »** (`src/screens/studio/TikTokVideosScreen.tsx`, accessible depuis TikTok Studio → tuile « Mes vidéos TikTok », route `studio.tiktok`) qui liste les vidéos du compte connecté (miniature, durée, vues, likes, commentaires, partages) et les joue via l'**embed officiel TikTok** (`src/components/tiktok/TikTokEmbed.web.tsx`, iframe `tiktok.com/embed`). Données chargées par le hook `useTikTokVideos`. ⚠️ Ne permet **pas** de chercher des vidéos publiques d'autres comptes (réservé à la Research API, accès limité aux institutions vérifiées) ni de télécharger le MP4 (TikTok ne fournit que l'embed/share URL).
- **Creator info** : `GET /v1/tiktok/creator-info` (requiert `video.publish`).
- **Publication** : `POST /v1/tiktok/publish` (Direct Post ou brouillon `draftOnly`, requiert `video.publish` / `video.upload`).
- **Suivi** : `GET /v1/tiktok/publish/:publishId/status`.
- **Déconnexion** : `POST /v1/tiktok/disconnect`.
- **Gating par scope** : chaque endpoint qui demande un scope non accordé renvoie un `403 TIKTOK_SCOPE_MISSING` clair, au lieu d'une erreur TikTok opaque.
- Rafraîchissement automatique du token d'accès via le refresh token.
- Côté UI : carte « Publier sur le vrai TikTok » dans l'éditeur média
  (`src/screens/studio/MediaEditorScreen.tsx`) avec états non configuré /
  non connecté / connecté, et **affichage conditionnel des boutons de
  publication selon les capacités réelles**, pilotée par `useTikTokConnect`
  (`src/hooks/useTikTokConnect.ts`) + `src/services/tiktokOAuth.ts`.

### Architecture

```
Frontend                         Backend
─────────                        ────────
tiktokOAuth.ts ──┐               routes/tiktok.routes.ts        (thin)
useTikTokConnect ┘──HTTP──────►  controllers/tiktok.controller  (HTTP boundary, zod, scope gating)
                                 services/tiktok.service.ts      (OAuth + Display API + Content Posting, zod)
                                 services/tiktokAccount.repo.ts  (DB + token refresh)
                                 config/tiktok.ts                (constantes, scopes, capacités, clés)
```

Le `client_secret` est lu uniquement côté backend (`config/tiktok.ts`) et
**n'est jamais exposé au frontend**.

> ⚠️ **Sécurité** : si un `client_secret` a été partagé/collé quelque part,
> régénère-le immédiatement dans le TikTok Developer Portal (App details →
> Credentials). Ne le mets jamais en dur dans le code ni dans le frontend.

### Activer Login Kit (fonctionne avec l'app actuelle)

1. Dans `backend/.env` (voir `backend/.env.example`) :
   ```
   TIKTOK_CLIENT_KEY=awde225g7m6cz4up
   TIKTOK_CLIENT_SECRET=<régénéré, jamais partagé>
   TIKTOK_REDIRECT_URI=https://<ton-domaine>/v1/tiktok/callback
   TIKTOK_FRONTEND_RETURN_URL=https://<ton-app>/
   TIKTOK_SCOPES=user.info.basic,video.list
   ```
   Le `redirect_uri` doit correspondre **exactement** à celui enregistré dans
   l'app TikTok (Redirect URI / Web).
2. Régénérer le client Prisma + migrer le modèle `TikTokAccount` :
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate dev --name tiktok_account
   ```
3. Déployer le backend en **HTTPS public** (TikTok ne redirige pas vers `localhost`).

### Activer la publication directe (Content Posting API)

1. Ajoute le produit **Content Posting API** à l'app sur https://developers.tiktok.com/
   et fais-la approuver pour les scopes `video.publish` et `video.upload`
   (review + vidéo démo de bout en bout).
2. Une fois approuvé, élargis les scopes :
   ```
   TIKTOK_SCOPES=user.info.basic,video.list,video.publish,video.upload
   ```
3. Le Direct Post via `PULL_FROM_URL` exige une **URL vidéo publique (https)**
   dont le préfixe de domaine est validé dans les réglages de l'app. Les blobs
   locaux ne peuvent pas être tirés par TikTok → l'UI bascule alors sur la
   publication manuelle.
4. Reconnecte le compte : les nouveaux scopes débloquent automatiquement les
   boutons « Publier sur mon profil » et « Envoyer dans mes brouillons ».

### Comportement de repli (honnête)

- **Pas de clés / backend injoignable** → publication manuelle (légende copiée +
  média téléchargé + ouverture de `tiktok.com/upload`).
- **Connecté en Login Kit seulement** → profil + liste vidéos disponibles, mais
  publication directe masquée avec un message explicite ; publication manuelle proposée.
- Aucune publication automatique n'est jamais simulée ou prétendue.

## 📄 Licence

MIT
