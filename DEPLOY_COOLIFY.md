# Déployer ORKY sur Coolify

Ce dépôt se déploie comme une stack Docker Compose complète :

- `web` : Next.js sur le port 3000 ;
- `api` : Fastify sur le port 4000 ;
- PostgreSQL ;
- Redis ;
- MinIO pour les médias ;
- LiveKit pour les directs WebRTC.

## 1. Créer l'application Coolify

Dans Coolify, crée une ressource **Docker Compose** depuis la branche `main` du dépôt. Le fichier à utiliser est `docker-compose.prod.yml`, avec le contexte du dépôt à sa racine.

Expose uniquement les domaines publics nécessaires :

- `web` : domaine de l'application ORKY ;
- `api` : domaine API si l'API n'est pas servie derrière le reverse proxy du frontend ;
- LiveKit : domaine HTTPS/WSS dédié, avec les ports média TCP/UDP requis par LiveKit.

Active HTTPS/Let's Encrypt pour les domaines publics.

## 2. Variables Coolify obligatoires

Génère les secrets dans Coolify ou avec un générateur local. Ne les committe jamais.

```env
NODE_ENV=production
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=orky
JWT_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGINS=https://orky.example.com
NEXT_PUBLIC_API_BASE_URL=https://orky.example.com

MINIO_ROOT_USER=...
MINIO_ROOT_PASSWORD=...
S3_BUCKET=orky
CDN_URL=https://cdn.example.com/orky

LIVEKIT_URL=wss://live.example.com
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_PRO=...
STRIPE_PRICE_BUSINESS=...

TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
TIKTOK_REDIRECT_URI=https://orky.example.com/v1/tiktok/callback
TIKTOK_FRONTEND_RETURN_URL=https://orky.example.com

NEXT_PUBLIC_SCRAPER_URL=https://scraper.example.com
```

`CORS_ORIGINS` accepte une liste d'origines séparées par des virgules. `NEXT_PUBLIC_API_BASE_URL` doit être une URL HTTPS publique ou l'URL interne appropriée si Coolify sert le frontend et l'API derrière le même proxy.

Le scraper n'est pas inclus dans cette stack : `NEXT_PUBLIC_SCRAPER_URL` doit pointer vers un dashboard Streamlit réellement déployé en HTTPS. Une URL localhost ou HTTP sera refusée par l'interface ORKY.

## 3. Configuration LiveKit

Copie `livekit.prod.yaml` dans la ressource Compose. Le fichier ne contient pas de secret. Le domaine LiveKit doit être accessible en WSS depuis les navigateurs et les ports média TCP/UDP doivent être ouverts selon la documentation LiveKit/Coolify.

Le webhook LiveKit doit pouvoir joindre :

```text
http://api:4000/v1/live/webhook
```

Configure également la signature/webhook selon les variables attendues par le backend.

## 4. Déploiement et migrations

Déploie la stack depuis Coolify. Le conteneur API exécute `prisma migrate deploy` avant de démarrer le serveur.

Vérifie ensuite :

```text
https://<domaine-api>/health
https://<domaine-web>/
```

Ne lance `prisma db seed` en production que si tu souhaites explicitement importer des données initiales et après sauvegarde de la base.

## 5. Contrôles post-déploiement

1. `GET /health` retourne un statut OK.
2. L'inscription et la connexion créent une vraie session.
3. Le profil ne montre pas de métriques inventées en cas d'erreur.
4. Découvrir interroge `/v1/feed/discover` et affiche un état vide/erreur explicite si aucune donnée n'existe.
5. Les uploads créent des objets MinIO/CDN et des vidéos persistées.
6. LiveKit utilise WSS et les événements webhook terminent bien les directs.
7. Stripe reçoit les webhooks signés sur l'endpoint prévu.
8. Le branding n'est modifiable que par un compte `admin` ou `moderator`.
9. Le scraper affiche une origine HTTPS configurée, jamais `localhost` en production.
10. Le checkout Shop reste indisponible tant qu'un vrai prestataire marchand n'est pas configuré.

## 6. Dépannage

- **CORS** : vérifier `CORS_ORIGINS`, sans `*` en production.
- **Frontend vers une mauvaise API** : vérifier `NEXT_PUBLIC_API_BASE_URL` et le rewrite `/v1/*`.
- **Médias inaccessibles** : vérifier `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_BUCKET` et `CDN_URL`.
- **Live sans vidéo** : vérifier `LIVEKIT_URL`, WSS, ports TCP/UDP et les clés LiveKit.
- **API qui refuse de démarrer** : vérifier que JWT, Stripe et les variables de stockage obligatoires sont présentes.
- **Scraper absent** : déployer séparément le dashboard en HTTPS et renseigner `NEXT_PUBLIC_SCRAPER_URL`.
