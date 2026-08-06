# 🚀 Déploiement TikTok Clone sur Coolify

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Coolify Server                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Frontend │  │ Backend  │  │ PostgreSQL       │  │
│  │ Next.js  │──│ Fastify  │──│ tiktok_clone db  │  │
│  │ :3000    │  │ :4000    │  │ :5432            │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│       │              │                               │
│       │         ┌──────────┐                        │
│       │         │  Redis   │                        │
│       │         │  :6379   │                        │
│       │         └──────────┘                        │
│       │                                              │
│  ┌──────────────────────────┐                       │
│  │     Reverse Proxy        │                       │
│  │  (Nginx / Traefik)       │                       │
│  └──────────────────────────┘                       │
└─────────────────────────────────────────────────────┘
```

## Prérequis

1. **Serveur Coolify** avec Docker installé
2. **Domaine** pointing vers ton serveur (optionnel mais recommandé)
3. **Git repository** GitHub avec le code

---

## Étape 1 : Créer l'application PostgreSQL

1. Dans Coolify, va dans **Applications** → **New**
2. Choisis **Docker Compose**
3. Nom : `tiktok-db`
4. Copie ce compose :

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: tiktok
      POSTGRES_PASSWORD: CHANGE_ME_STRONG_PASSWORD
      POSTGRES_DB: tiktok_clone
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U tiktok -d tiktok_clone']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pg_data:
```

5. **Deploy** cette application
6. Note l'**IP interne** de ce service (ex: `172.19.0.2`)

---

## Étape 2 : Créer l'application Backend API

1. Dans Coolify, **Applications** → **New** → **Docker Compose**
2. Nom : `tiktok-api`
3. **Source** : Git Repository
   - URL : `https://github.com/cyrano21/tiktok-clone`
   - Branch : `main`
   - Dockerfile Location : `backend/Dockerfile`
4. **Environment Variables** (dans Coolify) :

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://tiktok:CHANGE_ME_STRONG_PASSWORD@tiktok-db:5432/tiktok_clone
REDIS_URL=redis://tiktok-redis:6379
JWT_SECRET=GENERATE_RANDOM_32_CHARS
JWT_REFRESH_SECRET=GENERATE_RANDOM_32_CHARS
CORS_ORIGIN=https://ton-domaine.com
```

> ⚠️ **Important** : Remplace `CHANGE_ME_STRONG_PASSWORD` par le mot de passe que tu as mis dans l'étape 1.
> 
> Pour générer un JWT_SECRET aléatoire : `openssl rand -hex 32`

5. **Ports** : Expose le port `4000`
6. **Health Check** : `/health`
7. **Depends On** : `tiktok-db` (dans les settings networking de Coolify)

---

## Étape 3 : Créer l'application Redis

1. **Applications** → **New** → **Docker Compose**
2. Nom : `tiktok-redis`

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  redis_data:
```

3. **Deploy**

---

## Étape 4 : Créer l'application Frontend

1. **Applications** → **New** → **Docker Compose**
2. Nom : `tiktok-web`
3. **Source** : Git Repository
   - URL : `https://github.com/cyrano21/tiktok-clone`
   - Branch : `main`
   - Dockerfile Location : `Dockerfile.web`
4. **Environment Variables** :

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.ton-domaine.com
```

5. **Ports** : Expose le port `3000`
6. **Depends On** : `tiktok-api`

---

## Étape 5 : Configurer le Reverse Proxy

### Option A : Avec Coolify (recommandé)

Dans chaque application frontend/backend, Coolify crée automatiquement un proxy avec Let's Encrypt.

### Option B : Nginx manuel

```nginx
# Frontend
server {
    listen 80;
    server_name ton-domaine.com;
    
    location / {
        proxy_pass http://tiktok-web:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 80;
    server_name api.ton-domaine.com;
    
    location / {
        proxy_pass http://tiktok-api:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Étape 6 : Initialiser la base de données

Une fois le backend déployé, exécute les migrations :

1. Dans Coolify, va dans l'app `tiktok-api`
2. Onglet **Terminal** ou **Exec**
3. Lance :

```bash
npx prisma migrate deploy
npx prisma db seed
```

Ou utilise le script automatique :

```bash
npx prisma generate && npx prisma migrate deploy && npm run seed
```

---

## Étape 7 : Vérification

1. **Backend** : `https://api.ton-domaine.com/health` → doit retourner `{"status":"ok"}`
2. **Frontend** : `https://ton-domaine.com` → doit afficher l'app
3. **Login** : Utilise les comptes de démo :
   - `maxence_off@demo.app` / `password123`
   - `testuser@demo.app` / `password123`

---

## Variables d'environnement récapitulatives

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `POSTGRES_USER` | Utilisateur PostgreSQL | `tiktok` |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | ⚠️ À changer |
| `POSTGRES_DB` | Nom de la base | `tiktok_clone` |
| `DATABASE_URL` | URL de connexion DB | `postgresql://tiktok:...@postgres:5432/tiktok_clone` |
| `REDIS_URL` | URL Redis | `redis://redis:6379` |
| `JWT_SECRET` | Secret JWT | ⚠️ À générer |
| `JWT_REFRESH_SECRET` | Secret refresh JWT | ⚠️ À générer |
| `CORS_ORIGIN` | Origines CORS autorisées | `*` ou `https://ton-domaine.com` |
| `NEXT_PUBLIC_API_URL` | URL publique du backend | `https://api.ton-domaine.com` |

---

## 🔐 Sécurité en production

1. **Change TOUS les mots de passe** par défaut
2. **Génère des JWT secrets** aléatoires : `openssl rand -hex 32`
3. **Configure CORS** avec ton domaine exact (pas de `*`)
4. **Active HTTPS** via Let's Encrypt dans Coolify
5. **Limite les connexions** Redis et PostgreSQL

---

## 🐛 Dépannage

### "Connection refused" pour la DB
- Vérifie que le service PostgreSQL tourne
- Vérifie le mot de passe dans `DATABASE_URL`

### "JWT malformed"
- Vérifie que `JWT_SECRET` est défini dans les env vars

### CORS errors
- Vérifie `CORS_ORIGIN` correspond à ton domaine
- Vérifie que le frontend utilise la bonne `NEXT_PUBLIC_API_URL`

### Le build échoue
- Vérifie les logs dans Coolify → Onglet "Logs"
- Assure-toi que le repo GitHub est à jour
