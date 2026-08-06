# 🚀 Déploiement — TikTok Clone

## Architecture

```
Vercel (frontend Next.js)  ──►  Railway (backend Fastify)  ──►  Railway PostgreSQL + Redis + S3
```

## 1. Backend → Railway

1. Pousse le dossier `backend/` dans un repo Git séparé (ou root du monorepo).
2. Sur Railway, crée un **nouveau projet** → **Deploy from GitHub repo**.
3. Railway détecte `railway.json` + `Dockerfile` automatiquement.
4. Ajoute les variables d'environnement :

   | Variable | Valeur |
   |----------|--------|
   | `DATABASE_URL` | URL PostgreSQL Railway (créée avec un plugin PostgreSQL) |
   | `REDIS_URL` | URL Redis (plugin Redis) |
   | `JWT_SECRET` | Clé secrète aléatoire |
   | `JWT_REFRESH_SECRET` | Clé secrète aléatoire |
   | `PORT` | `4000` |
   | `NODE_ENV` | `production` |
   | `AWS_ACCESS_KEY_ID` | Clé S3 (Cloudflare R2 / Backblaze B2) |
   | `AWS_SECRET_ACCESS_KEY` | Secret S3 |
   | `S3_BUCKET` | Nom du bucket |
   | `S3_ENDPOINT` | Endpoint S3 |
   | `TIKTOK_CLIENT_KEY` | Clé app TikTok (optionnel) |
   | `TIKTOK_CLIENT_SECRET` | Secret app TikTok (optionnel) |

5. L'API sera disponible sur `https://<projet>.up.railway.app` → health check `/health`.

## 2. Frontend → Vercel

1. Pousse `tiktok-clone/` dans un repo Git.
2. Sur Vercel : **New Project** → importe le repo.
3. Vercel détecte Next.js automatiquement (`vercel.json` présent).
4. Variable d'environnement :

   | Variable | Valeur |
   |----------|--------|
   | `NEXT_PUBLIC_API_BASE_URL` | `https://<projet>.up.railway.app/v1` |

5. Déploie.

## 3. Vérification post-déploiement

- `curl https://<railway-url>/health` → `{"status":"ok",...}`
- `curl https://<railway-url>/v1/feed/for-you?limit=1` → vidéos
- Ouvrir l'app Vercel → le feed se charge avec les données réelles.

## 4. Docker local (dev complet)

```bash
docker compose up -d          # PostgreSQL + Redis + MinIO + API
npm install --legacy-peer-deps
npm run dev                   # frontend sur http://localhost:3000
```

Le frontend pointe vers le backend via `.env.local` :
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/v1
```

## Comptes de démo seedés

| Email | Mot de passe |
|-------|--------------|
| `demo@demo.app` | `password123` |
| `leamartin@demo.app` | `password123` |
| `maxence_off@demo.app` | `password123` |
