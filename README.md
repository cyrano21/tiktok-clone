# TikTok Clone — plateforme vidéo verticale + Studio SaaS

Le dépôt a commencé comme un clone TikTok, mais son architecture actuelle vise une plateforme vidéo verticale exploitable comme produit : feed personnalisé, création et publication, messagerie, live WebRTC, modération, white-label, analytics, cross-posting et abonnement SaaS.

## Architecture réelle

L'application principale est web : **Next.js 14 + React 18 + react-native-web**. Le backend est une API **Fastify 4 + Prisma 5 + PostgreSQL + Redis**. Les médias sont normalisés par **FFmpeg/ffprobe** avant stockage S3-compatible. Le live web utilise **LiveKit/WebRTC** ; les écrans natifs ne simulent plus de diffusion tant que le SDK LiveKit React Native n'est pas intégré.

```text
tiktok-clone/
├── app/                     # entrée Next.js / web
├── src/
│   ├── components/          # vidéo, éditeur média, UI et sécurité
│   ├── screens/             # feed, explore, studio, inbox, profil, live...
│   ├── navigation/
│   ├── hooks/
│   ├── services/            # API, TikTok, SaaS, modération, live
│   ├── store/               # Zustand
│   ├── theme/
│   └── types/
├── backend/
│   ├── src/
│   │   ├── config/          # PostgreSQL, Redis, S3, TikTok, Stripe
│   │   ├── middleware/      # auth, rate-limit, upload
│   │   ├── routes/          # API v1
│   │   └── services/        # recommandation, médias, notifications...
│   └── prisma/              # schéma + migrations
├── livekit.dev.yaml         # LiveKit local uniquement
├── __tests__/
├── Dockerfile
├── Dockerfile.backend
├── backend/Dockerfile
└── docker-compose.yml
```

## Stack

- Frontend : Next.js 14.2, React 18, react-native-web, Zustand
- Backend : Fastify 4, TypeScript, Prisma 5
- Données : PostgreSQL 16 + Redis 7
- Médias : FFmpeg/ffprobe + stockage S3-compatible / MinIO
- Live web : LiveKit + WebRTC
- Auth : JWT access + refresh
- Paiement : Stripe Checkout + Billing Portal + webhooks signés
- Distribution : API officielles TikTok quand les scopes sont accordés
- Déploiement : Docker / Coolify

## Fonctionnalités principales

- Feed vertical « For You » et « Following »
- Ranking personnalisé utilisant likes, sauvegardes, watch completion, créateurs, hashtags, sons, fraîcheur et diversité
- Lecture vidéo, double-tap like, commentaires, sauvegarde et partage
- Likes de commentaires idempotents avec contrainte unique `(userId, commentId)`
- Commentaires/réponses persistés dans PostgreSQL, sans données seed dans l'écran réel
- Profils, follows, recherche, hashtags et sons
- Messagerie avec contrôle d'appartenance aux conversations
- Publication média réelle : upload multipart, FFmpeg, miniature serveur, stockage S3/MinIO, persistance Prisma
- Live web réel : caméra/micro WebRTC, jetons LiveKit signés, lecture distante et compteurs synchronisés par webhook signé
- Studio de publication et file de cross-posting
- White-label et plans FREE / PRO / BUSINESS
- Analytics
- Blocage utilisateur, signalement, file de modération, sanctions et appels
- Intégration TikTok Login Kit / Content Posting API selon les scopes disponibles
- Stripe Billing réel : aucun plan payant n'est activé par une simple réponse du navigateur

## API

| Prefix | Module |
|---|---|
| `/v1/auth` | authentification |
| `/v1/feed` | For You / Following / trending / live |
| `/v1/videos` | upload média, vidéos, interactions et commentaires |
| `/v1/users` | profils et follows |
| `/v1/comments` | réponses et likes de commentaires |
| `/v1/hashtags` | hashtags |
| `/v1/sounds` | sons |
| `/v1/search` | recherche |
| `/v1/messages` | conversations et messages |
| `/v1/live` | sessions LiveKit, découverte, join/end et webhook |
| `/v1/notifications` | notifications |
| `/v1/moderation` | reports, blocks, actions et appels |
| `/v1/analytics` | analytics |
| `/v1/billing` | Stripe Checkout / Portal / webhook |
| `/v1/publish` | cross-posting |
| `/v1/branding` | white-label |
| `/v1/tiktok` | intégration officielle TikTok |

## Démarrage local

Le moyen le plus complet est Docker Compose, car le pipeline média a besoin de MinIO + FFmpeg et le live a besoin du SFU LiveKit :

```bash
docker compose up -d --build
```

Services locaux :

- frontend Next.js : port 3000 quand lancé séparément avec `npm run dev` ;
- API : `http://localhost:4000` ;
- PostgreSQL : 5432 ;
- Redis : 6379 ;
- MinIO : 9000 / console 9001 ;
- LiveKit : WebSocket/API 7880, TCP WebRTC 7881, UDP WebRTC 7882.

Pour lancer les processus Node séparément :

```bash
npm install --legacy-peer-deps
npm run dev

cd backend
npm install --legacy-peer-deps
npx prisma generate
npx prisma migrate dev
npm run dev
```

Le frontend utilise les rewrites `/v1/*` ou `NEXT_PUBLIC_API_BASE_URL` pour joindre le backend.

## Pipeline média réel

`POST /v1/videos` accepte un multipart authentifié. Le backend :

1. écrit le flux entrant dans un fichier temporaire avec limite 100 Mo ;
2. inspecte réellement le média avec `ffprobe` ;
3. applique découpage, luminosité, contraste, saturation, niveaux de gris et texte serveur ;
4. normalise la sortie en MP4 H.264/AAC via `ffmpeg` ;
5. génère une miniature JPEG ;
6. envoie vidéo + miniature dans S3/MinIO ;
7. persiste la vidéo et ses hashtags dans une transaction Prisma ;
8. supprime les objets S3 déjà envoyés si la persistance échoue.

Les images JPEG/PNG/WebP sont transformées en courtes vidéos MP4. Les médias distants de démonstration ont été retirés de l'éditeur : l'utilisateur importe un vrai fichier ou enregistre sa caméra.

Variables utiles :

```env
S3_ENDPOINT=http://localhost:9000
S3_FORCE_PATH_STYLE=true
S3_BUCKET=tiktok-clone-videos
CDN_URL=http://localhost:9000/tiktok-clone-videos
FFMPEG_PRESET=veryfast
FFMPEG_CRF=23
```

En production, `CDN_URL` doit être une URL HTTPS publique si le média doit ensuite être consommé par TikTok `PULL_FROM_URL`.

## LiveKit / WebRTC

La version web ne repose plus sur un bouton `setIsLive(true)` ni sur de faux spectateurs. Le parcours est :

```text
créateur authentifié
  -> POST /v1/live/start
  -> jeton LiveKit host signé côté backend
  -> connexion Room WebRTC
  -> publication caméra + microphone
  -> LiveKit SFU
  -> POST /v1/live/:id/join
  -> jeton viewer non-publisher
  -> abonnement aux pistes distantes
```

LiveKit envoie ses événements à :

```text
POST /v1/live/webhook
```

Le backend vérifie la signature avec `WebhookReceiver` et synchronise les entrées/sorties de spectateurs ainsi que la fin d'une room. Le room name interne n'est pas exposé dans la liste publique des lives.

Configuration locale : `livekit.dev.yaml`. Elle contient volontairement des identifiants de développement (`devkey` / `secret`) et ne doit pas être réutilisée en production.

Variables de production :

```env
LIVEKIT_URL=wss://live.ton-domaine
LIVEKIT_API_KEY=<clé forte>
LIVEKIT_API_SECRET=<secret fort>
```

Le serveur LiveKit de production doit être exposé avec TLS/WSS et ses ports média TCP/UDP correctement routés. La partie web est implémentée ; les écrans non-web refusent explicitement de simuler un live tant que le SDK LiveKit React Native n'est pas branché.

## Stripe Billing

Les produits live Stripe associés au projet sont :

- PRO : 9,99 €/mois — `price_1U1mDNAh4XCbPrbnMiEUNHFJ`
- BUSINESS : 29,99 €/mois — `price_1U1mDXAh4XCbPrbnJbQxIXPt`

Variables backend requises en production :

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_1U1mDNAh4XCbPrbnMiEUNHFJ
STRIPE_PRICE_BUSINESS=price_1U1mDXAh4XCbPrbnJbQxIXPt
APP_URL=https://ton-domaine
STRIPE_SUCCESS_URL=https://ton-domaine/studio/billing?checkout=success
STRIPE_CANCEL_URL=https://ton-domaine/studio/billing?checkout=cancelled
STRIPE_PORTAL_RETURN_URL=https://ton-domaine/studio/billing
```

Webhook Stripe :

```text
POST https://<backend>/v1/billing/webhook
```

Événements minimum : `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`.

Le backend vérifie la signature Stripe sur le corps brut. Les droits PRO/BUSINESS sont synchronisés depuis `customer.subscription.*`; `/checkout` ne modifie jamais directement le plan local.

## Modération et sécurité UGC

Le socle serveur comprend :

- signalement de user / video / comment / message / live ;
- catégories et priorité de traitement ;
- déduplication des signalements ouverts ;
- blocage bilatéral dans les feeds et conversations ;
- rôles `moderator` / `admin` ;
- avertissement, suspension, bannissement et retrait de contenu ;
- journal d'actions de modération ;
- appels utilisateur et décision d'un modérateur ;
- commentaires retirés exclus des surfaces publiques ;
- utilisateurs bannis/suspendus exclus des feeds ;
- contrôle d'appartenance aux conversations avant lecture/écriture.

## Recommandation

Le service `backend/src/services/recommendation.service.ts` combine notamment : likes, sauvegardes, watch completion, créateurs suivis, affinité créateur, hashtags, sons, interactions Redis, fraîcheur, engagement, pénalité des vidéos récemment vues et diversification des créateurs.

Le ranking reste une heuristique de première génération : il doit être mesuré avec de vraies métriques de rétention et des expériences contrôlées avant d'être présenté comme un système ML de production.

## Intégration TikTok officielle

| Produit | Scopes | Capacités |
|---|---|---|
| Login Kit | `user.info.basic`, `video.list` | connexion, profil, vidéos du compte connecté |
| Content Posting API | `video.publish`, `video.upload` | publication directe / brouillon |

Le backend stocke et rafraîchit les tokens TikTok. Le `client_secret` reste côté serveur. Quand un scope de publication n'est pas disponible, l'UI masque la capacité au lieu de simuler une publication.

## Validation obligatoire avant merge

Cette branche ajoute des dépendances et une migration. Elle ne doit pas être déclarée verte sans exécuter :

```bash
npm install --legacy-peer-deps
npm run typecheck
npm test
npm run build

cd backend
npm install --legacy-peer-deps
npx prisma generate
npx prisma migrate dev
npm run build
npm test
```

Puis valider réellement :

1. upload MP4/WebM + image et lecture du MP4 durable depuis MinIO/S3 ;
2. génération de miniature ;
3. like/unlike d'un commentaire avec compteur stable ;
4. démarrage d'un live caméra/micro ;
5. connexion d'un second navigateur comme viewer ;
6. augmentation/diminution du compteur via webhook LiveKit ;
7. fin du live et disparition de la liste active.

## Licence

MIT
