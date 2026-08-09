# ORKY — vidéo verticale + commerce Orchidy

ORKY est une plateforme vidéo verticale web construite avec **Next.js 14 + React 18 + react-native-web** et une API **Fastify + Prisma + PostgreSQL + Redis**. Les produits et le checkout marchand restent sous l'autorité d'**Orchidy** : ORKY référence les produits réels mais ne fait jamais confiance à un prix ou un stock provenant du navigateur.

## Architecture

```text
ORKY web (Next.js)
  ├─ feed / profils / commentaires / messagerie / Studio
  ├─ Shop -> proxy catalogue Orchidy
  ├─ checkout handoff signé -> Orchidy
  └─ recherche externe TikTok (lecture seule, opt-in)

ORKY API (Fastify)
  ├─ PostgreSQL / Prisma
  ├─ Redis
  ├─ FFmpeg / ffprobe
  ├─ MinIO/S3 privé
  ├─ LiveKit/WebRTC
  ├─ Stripe Billing
  └─ TikTok OAuth / Content Posting selon scopes

Orchidy
  ├─ catalogue / variantes / stocks / devises
  ├─ panier authentifié
  └─ secure-checkout / commandes / paiement
```

## Principes de vérité produit

- `NEXT_PUBLIC_USE_DEMO` est **fail-closed** : la démo n'est activée que si la valeur est exactement `true`.
- Le scraper TikTok ne remplace jamais silencieusement le feed ORKY. `NEXT_PUBLIC_USE_SCRAPER_FEED=true` est un mode explicite de recherche et les références externes restent **lecture seule**.
- Une vidéo native ORKY est une entité Prisma. Les contenus externes ne reçoivent pas artificiellement des likes/follows ORKY.
- `VideoProductMatch` relie une vidéo à un identifiant de catalogue Orchidy. ORKY ne stocke aucune autorité de prix/stock dans cette relation.
- Le panier ORKY est persisté. Un paiement Orchidy signé retire uniquement les quantités du handoff payé, pas les nouveaux articles ajoutés ensuite.
- Le bucket média est privé. Les vidéos ORKY publiques sont servies via `/v1/media/*`; les nouvelles publications `friends/private` sont refusées tant que le parcours navigateur signé complet n'est pas activé.
- Le dashboard vendeur et l'édition produit restent dans Orchidy. ORKY n'affiche plus de commandes ou revenus vendeur inventés.
- Aucun job de cross-posting multi-plateformes n'est créé sans worker réel. Reels/Shorts sont affichés indisponibles tant que leurs connecteurs ne sont pas implémentés.
- Le plan BUSINESS n'est pas commercialisé tant que les espaces équipe/API/webhooks ne sont pas implémentés.

## Média réel

`POST /v1/videos` reçoit un multipart authentifié puis :

1. limite le flux entrant à 100 Mo ;
2. inspecte le média avec `ffprobe` ;
3. applique trim/filtres/texte ;
4. normalise en MP4 H.264/AAC via FFmpeg ;
5. génère une miniature ;
6. envoie les objets dans S3/MinIO ;
7. persiste la vidéo et les hashtags dans PostgreSQL ;
8. supprime les objets si la transaction DB échoue.

Les clés S3 sont persistées (`videoStorageKey`, `thumbnailStorageKey`). Le navigateur ne dépend pas d'un bucket anonyme.

## Vidéo shoppable

Le parcours réel est :

```text
Produit réel Orchidy
  -> "Créer une vidéo shoppable" dans ORKY
  -> upload/persistance vidéo ORKY
  -> VideoProductMatch(catalogItemId, variantKey)
  -> produit affiché dans le feed
  -> panier ORKY
  -> handoff HMAC
  -> Orchidy revalide produit/variante/options/stock/prix/devise
  -> secure-checkout Orchidy
  -> reçu HMAC Orchidy
  -> ORKY réconcilie uniquement le snapshot payé
```

## Checkout ORKY ↔ Orchidy

Les deux applications partagent uniquement un secret serveur :

```env
ORKY_CHECKOUT_HANDOFF_SECRET=<32+ caractères aléatoires>
```

Côté Orchidy, autoriser explicitement les origines ORKY :

```env
ORKY_RETURN_ORIGINS=https://orky.example.com
```

Le payload ORKY contient seulement `productId`, `variantKey`, `selectedOptions`, `quantity`, `source` et `returnUrl`. Aucun prix ou total client n'est accepté comme source de vérité.

Le contexte de handoff v2 est lié à :

- l'utilisateur Orchidy ;
- l'identifiant du handoff ;
- l'empreinte SHA-256 du panier autoritaire ;
- une expiration ;
- le `clientRequestId` du secure-checkout, lié côté serveur avant paiement.

Un ancien paiement appartenant au même utilisateur ne peut donc plus être réutilisé pour fabriquer un reçu `paid` pour un nouveau panier.

## Live

Le live web utilise LiveKit/WebRTC. Les tokens host/viewer sont signés côté API et les compteurs sont synchronisés par webhook LiveKit vérifié. Les écrans natifs ne simulent pas un live tant que le SDK natif LiveKit n'est pas branché.

## Stripe Billing

Les droits payants sont synchronisés uniquement depuis les webhooks Stripe signés.

- FREE : publication/interactions ORKY, média serveur, résumé analytics, TikTok lecture selon scopes.
- PRO : analytics avancées + Content Posting TikTok si le compte/app possède réellement les scopes nécessaires.
- BUSINESS : **non commercialisé actuellement** ; l'UI indique « bientôt disponible ».

## TikTok OAuth

Les access/refresh tokens TikTok sont chiffrés en base avec **AES-256-GCM**. La clé est obligatoire en production :

```env
TIKTOK_TOKEN_ENCRYPTION_KEY=<32 octets, hex 64 caractères ou base64>
```

Les anciennes lignes plaintext restent lisibles pendant la migration progressive et sont réécrites chiffrées au prochain refresh/upsert.

## Recherche externe / scraper

Le service scraper est interne :

- `ThreadingHTTPServer` ;
- secret serveur `SCRAPER_INTERNAL_SECRET` ;
- nombre de téléchargements yt-dlp simultanés borné ;
- IDs validés ;
- Range requests supportées ;
- pas de CORS `*` ;
- pas de Picsum/pravatar pour combler une donnée manquante ;
- `/reload` non exposé par le proxy navigateur ;
- proxy Next same-origin avec allowlist de routes et rate-limit.

Le feed ORKY canonique reste `/v1/feed/for-you`. Le scraper ne sert jamais l'onglet Following.

## Déploiement Coolify

Le dépôt reste prévu pour **Coolify**, pas pour un workflow GitHub de déploiement. Utiliser `docker-compose.prod.yml`.

Variables critiques en plus de PostgreSQL/Redis/MinIO :

```env
JWT_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGINS=https://orky.example.com
CDN_URL=https://legacy-object-prefix.example.com/bucket
LIVEKIT_URL=wss://live.example.com
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_1U1mDNAh4XCbPrbnMiEUNHFJ
STRIPE_PRICE_BUSINESS=price_1U1mDXAh4XCbPrbnJbQxIXPt
TIKTOK_TOKEN_ENCRYPTION_KEY=...
SCRAPER_INTERNAL_SECRET=...
ORKY_CHECKOUT_HANDOFF_SECRET=...
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/v1
NEXT_PUBLIC_ORCHIDY_BASE_URL=https://orchidy.fr
NEXT_PUBLIC_USE_DEMO=false
NEXT_PUBLIC_USE_SCRAPER_FEED=false
```

`CDN_URL` sert encore à retrouver les clés de médias historiques. Il ne signifie pas que le bucket doit être public.

## Validation avant merge

Frontend :

```bash
npm install --legacy-peer-deps
npm run typecheck
npm test -- --runInBand
npm run build
npx playwright install chromium
npm run test:e2e
```

Backend :

```bash
cd backend
npm install --legacy-peer-deps
npx prisma generate
npx prisma migrate deploy
npm run typecheck
npm test -- --runInBand
npm run build
```

Puis démarrer l'infrastructure :

```bash
docker compose up -d --build
```

Parcours manuels/E2E obligatoires : upload MP4/image, feed et états like/save, commentaire, LiveKit à deux navigateurs, outage Orchidy sans faux produit, panier avec quantité/variante, handoff/rejeu/expiration, paiement succès/annulation, retour signé, et absence de perte des articles ajoutés après le handoff.

## Licence

MIT
