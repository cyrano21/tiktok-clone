# Scrapling dans ORKY

Scrapling est une couche de résilience pour la recherche TikTok publique. Il ne remplace pas les sources autoritaires déjà présentes.

## Ordre de collecte

1. Apify reste utilisé pour les tendances par hashtag lorsqu'un `APIFY_TOKEN` est configuré.
2. `yt-dlp` reste utilisé pour l'énumération et les métadonnées média lorsqu'il fonctionne.
3. Scrapling intervient seulement si `yt-dlp` ne peut plus énumérer un profil ou lire les métadonnées publiques de la page.

Les URLs découvertes par Scrapling restent des références externes en lecture seule. Elles ne deviennent jamais des vidéos/utilisateurs ORKY natifs par simple scraping.

## Sélecteurs adaptatifs

Le sélecteur des liens vidéo de profil est enregistré avec un identifiant stable. Si TikTok change son DOM, Scrapling peut essayer de retrouver l'élément à partir de l'état précédemment enregistré.

L'état adaptatif est persisté par défaut dans :

```text
/app/data/scrapling-adaptive.db
```

Le volume `/app/data` existe déjà dans le service scraper. Le chemin peut être surchargé avec :

```env
SCRAPLING_STORAGE_FILE=/app/data/scrapling-adaptive.db
```

## Déploiement

Aucune nouvelle API publique n'est ajoutée. `scrapling_source.py` s'exécute dans le conteneur `scraper-api` existant.

Après changement de dépendances, reconstruire l'image du scraper afin d'installer `scrapling[fetchers]` et de copier `scrapling_source.py`.

## Garde-fous

- aucune authentification TikTok contournée ;
- uniquement des pages publiques ;
- `yt-dlp` garde la responsabilité du média ;
- les échecs Scrapling retournent au pipeline existant sans transformer des données absentes en données factices ;
- les données externes n'alimentent jamais silencieusement le feed canonique ORKY.
