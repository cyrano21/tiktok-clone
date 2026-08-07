# TikTok Clone — plateforme vidéo verticale + Studio SaaS

Le dépôt a commencé comme un clone TikTok, mais son architecture actuelle vise une plateforme vidéo verticale exploitable comme produit : feed personnalisé, création et publication, messagerie/live, modération, white-label, analytics, cross-posting et abonnement SaaS.

## Architecture réelle

Le frontend n'est plus un projet Expo/React Native natif autonome. L'application web utilise **Next.js 14 + React 18 + react-native-web**, avec des composants écrits dans le style React Native et rendus sur le web. Le backend est une API **Fastify 4 + Prisma 5 + PostgreSQL + Redis**.

```text
tiktok-clone/
├── app/                     # entrée Next.js / web
├── src/
│   ├── components/          # composants vidéo, UI et sécurité
│   ├── screens/             # feed, explore, studio, inbox, profil, live...
│   ├── navigation/          # navigation applicative
│   ├── hooks/
│   ├── services/            # API, TikTok, SaaS, modération
│   ├── store/               # Zustand
│   ├── theme/
│   └── types/
├── backend/
│   ├── src/
│   │   ├── config/          # PostgreSQL, Redis, S3, TikTok, Stripe
│   │   ├── middleware/      # auth, rate-limit, upload
│   │   ├── routes/          # API v1
│   │   ├── controllers/
│   │   └── services/        # recommandation, vidéo, notifications...
│   └── prisma/              # schéma + migrations
├── __tests__/
├── Dockerfile.web
├── Dockerfile.backend
└── docker-compose.prod.yml
```

## Stack

- Frontend : Next.js 14.2, React 18, react-native-web, Zustand
- Backend : Fastify 4, TypeScript, Prisma 5
- Données : PostgreSQL 16 + Redis 7
- Médias : stockage S3-compatible / MinIO
- Temps réel : WebSocket
- Auth : JWT access + refresh
- Paiement : Stripe Checkout + Billing Portal + webhooks signés
- Distribution : API officielles TikTok quand les scopes sont accordés
- Déploiement : Docker / Coolify

## Fonctionnalités principales

- Feed vertical « For You » et « Following »
- Ranking personnalisé utilisant likes, sauvegardes, watch completion, créateurs, hashtags, sons, fraîcheur et diversité
- Lecture vidéo, double-tap like, commentaires, sauvegarde, partage
- Profils, follows, recherche, hashtags et sons
- Messagerie et live
- Studio de publication et file de cross-posting
- White-label et plans FREE / PRO / BUSINESS
- Analytics
- Blocage utilisateur, signalement vidéo/contenu, file de modération, sanctions et appels
- Intégration TikTok Login Kit / Content Posting API selon les scopes disponibles
- Stripe Billing réel : aucun plan payant n'est activé par une simple réponse du navigateur

## API

| Prefix | Module |
|---|---|
| `/v1/auth` | authentification |
| `/v1/feed` | For You / Following / trending / live |
| `/v1/videos` | vidéos, interactions et commentaires |
| `/v1/users` | profils et follows |
| `/v1/comments` | commentaires |
| `/v1/hashtags` | hashtags |
| `/v1/sounds` | sons |
| `/v1/search` | recherche |
| `/v1/messages` | conversations et messages |
| `/v1/live` | live |
| `/v1/notifications` | notifications |
| `/v1/moderation` | reports, blocks, actions et appels |
| `/v1/analytics` | analytics |
| `/v1/billing` | Stripe Checkout / Portal / webhook |
| `/v1/publish` | cross-posting |
| `/v1/branding` | white-label |
| `/v1/tiktok` | intégration officielle TikTok |

## Démarrage local

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend web

```bash
npm install
npm run dev
```

Le frontend Next.js utilise les rewrites `/v1/*` ou `NEXT_PUBLIC_API_BASE_URL` pour joindre le backend.

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

Webhook Stripe à enregistrer :

```text
POST https://<backend>/v1/billing/webhook
```

Événements minimum :

```text
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
checkout.session.completed
```

Le backend vérifie la signature Stripe sur le corps brut. Les droits PRO/BUSINESS sont synchronisés depuis `customer.subscription.*`; `/checkout` ne modifie jamais directement le plan local.

## Modération et sécurité UGC

La plateforme possède désormais un socle de sécurité serveur :

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

L'interface du feed expose également un menu de sécurité permettant de signaler une vidéo ou bloquer son créateur.

## Recommandation

Le service `backend/src/services/recommendation.service.ts` ne se contente plus de trier par popularité. Le profil de préférence combine notamment :

- likes ;
- sauvegardes ;
- watch completion ;
- créateurs suivis ;
- affinité créateur ;
- hashtags ;
- sons ;
- interactions Redis ;
- fraîcheur ;
- engagement ;
- pénalité des vidéos récemment vues ;
- diversification des créateurs ;
- exclusion des utilisateurs bloqués/suspendus/bannis.

Le ranking reste une heuristique de première génération : il devra être mesuré avec des métriques de rétention et des expériences contrôlées avant d'être considéré comme un système ML de production.

## Intégration TikTok officielle

Deux niveaux sont gérés selon les scopes réellement accordés :

| Produit | Scopes | Capacités |
|---|---|---|
| Login Kit | `user.info.basic`, `video.list` | connexion, profil, vidéos du compte connecté |
| Content Posting API | `video.publish`, `video.upload` | publication directe / brouillon |

Le backend stocke et rafraîchit les tokens TikTok. Le `client_secret` reste côté serveur. Quand un scope de publication n'est pas disponible, l'UI masque la capacité au lieu de simuler une publication.

Variables principales :

```env
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://<backend>/v1/tiktok/callback
TIKTOK_FRONTEND_RETURN_URL=https://<frontend>/
TIKTOK_SCOPES=user.info.basic,video.list
```

## Validation

```bash
npm run typecheck
npm test
npm run build

cd backend
npm run build
npm test
```

Avant un déploiement Coolify, appliquer les migrations Prisma et renseigner les secrets JWT, Stripe, TikTok, PostgreSQL, Redis et stockage objet dans l'environnement Coolify. Aucun secret ne doit être commité dans le dépôt.

## Licence

MIT
