# Contrat Trend → Sourcing → Publication (ORKY ↔ Orchidy Pro)

Boucle verticale MVP : ORKY détecte une tendance vidéo → l'utilisateur la sélectionne →
Orchidy Pro source chez les fournisseurs → un candidat est approuvé → le produit est créé
et publié sur la marketplace Orchidy → il devient visible dans le Shop ORKY.

La vidéo source est **un signal d'inspiration**, jamais un contenu ré-hébergé. Le produit
vendu est l'objet commercial Orchidy.

## Architecture

```
ORKY (tiktok-clone)
  TrendRadarScreen (explore.trends)
    → trendService.listTrends()          # signaux depuis le scraper (60 vidéos réelles)
    → trendService.sendToSourcing()      # POST via proxy Next
    → trendService.approveCandidate()
        ↓ proxy Next /api/trends/sourcing/[...path]  (session ORKY + x-api-key)
Orchidy Pro (orchidy-pro / dsers-patched)
  POST /api/viral-sourcing/requests                # crée la demande + source CJ/AliExpress
  GET  /api/viral-sourcing/requests                # liste
  GET  /api/viral-sourcing/requests/:id            # détail + candidats
  POST /api/viral-sourcing/requests/:id/approve    # crée le produit + publie vers Orchidy
        ↓ pipeline de publication réel
Orchidy marketplace (Orchidy.new)
  GET /api/products          # le produit publié est visible
        ↓ proxy Next /api/orchidy/products
ORKY Shop
```

## Signal envoyé par ORKY (POST /api/viral-sourcing/requests)

```json
{
  "signal": {
    "sourceApp": "orky",
    "sourcePlatform": "tiktok",
    "sourceVideoUrl": "https://www.tiktok.com/@creator/video/123",
    "sourceEmbedUrl": "…",
    "creatorUsername": "…",
    "creatorDisplayName": "…",
    "caption": "Cette lampe sunset transforme mon bureau…",
    "hashtags": ["#lampe", "#sunset"],
    "detectedProductName": "Lampe sunset",
    "detectedKeywords": ["lampe sunset", "projection"],
    "detectedCategory": "home",
    "thumbnailUrl": "…",
    "viralStats": { "views": 1200000, "likes": 85000, "comments": 3400, "shares": 0 },
    "requestedBy": "…",
    "requestedByUsername": "…"
  }
}
```

Sanitization côté orchidy-pro : caption ≤ 2000, productName ≤ 200, hashtags ≤ 30,
keywords ≤ 12, viralStats finis (NaN/Infinity rejetés).

## Réponse

`POST /api/viral-sourcing/requests` → `201` :
```json
{ "success": true, "requestId": "…", "status": "candidates_ready", "candidates": [ … ] }
```

Candidat :
```json
{
  "candidateId": "aliexpress-123",
  "supplierId": "…", "supplierName": "AliExpress", "platform": "aliexpress",
  "title": "Sunset Projection Lamp…", "imageUrl": "…", "productUrl": "…",
  "price": "12.99", "currency": "EUR",
  "stock": 500, "stockKnown": true,
  "shippingDays": 14,
  "matchScore": 0.73, "matchType": "exact" | "similar" | "alternative",
  "riskFlags": [],
  "suggestedRetailPrice": 28.58, "estimatedMargin": 0.55
}
```

## Approbation

`POST /api/viral-sourcing/requests/:id/approve` body `{ "candidateId": "…" }` :
1. marque la demande `approved`
2. `createOrchidyProductFromSupplier` (Orchidy Pro) → produit dans la collection `products`
3. publication vers la marketplace Orchidy via `prepareSourceProductForPublication` →
   `buildCanonicalPublishedItem` → `PublicationDispatcher` / `OrchidyTargetAdapter`
4. réponse : `{ success, requestId, productId, productUrl, orchidyMarketplaceProductId, status: "published" | "product_created" }`

`status: "product_created"` = fiche créée, publication marketplace en attente
(connexion boutique ou éligibilité).

## Auth & sécurité

- Chaque route orchidy-pro : `guardRequest` `session-or-api-key` + rate limit.
- Proxy Next ORKY : exige une **session ORKY** (Bearer vérifié via `/v1/auth/me`) — le
  sourcing déclenche des appels fournisseurs coûteux, réservé aux utilisateurs connectés.
- Proxy Next → orchidy-pro : header `x-api-key: <ORCHIDY_PRO_API_KEY>`.
- `ORCHIDY_PRO_API_KEY` (ORKY) doit être une clé API valide dans la DB orchidy-pro.

## Variables d'environnement

| Variable (ORKY) | Description |
| --- | --- |
| `ORCHIDY_PRO_API_URL` / `NEXT_PUBLIC_ORCHIDY_PRO_URL` | Origine d'Orchidy Pro (ex: `https://pro.orchidy.fr`) |
| `ORCHIDY_PRO_API_KEY` | Clé API valide orchidy-pro pour l'interop |

## État

- Modules déployés sur `main` : ORKY `1d69f35`, orchidy-pro `1bb9600a`.
- Tests : 3 vitest (viral-sourcing), 10 vitest (request-guard + OrchidyTargetAdapter),
  52 Jest ORKY, typecheck + build Next verts.
- Prochaine étape : publication TikTok de la vidéo ORKY générée (canal de republication),
  puis boucle de conversion (ventes → sélection des prochaines tendances).
