# Contrats inter-applications — Lot 1 (PLAN-ORCHIDS)

Ce paquet contient les **10 contrats canoniques versionnés** échangés entre
**ORKY**, **Orchidy Pro** et **Orchidy** (le système agentique ORKY ↔ Pro ↔ Orchidy).

## Emplacement et source de vérité

| Rôle | Emplacement |
|---|---|
| **Source de vérité canonique** | `orchidy-pro/lib/contracts/v1/` |
| Copie synchronisée — ORKY | `tiktok-clone/src/contracts/v1/` |
| Copie synchronisée — Orchidy | `orchidy/src/contracts/v1/` |

Le paquet canonique synchronisé est composé de `README.md` + `v1/` : les trois copies de
cet ensemble sont **identiques** (vérifié par hash). Toute modification se fait dans la
source de vérité (`orchidy-pro/lib/contracts/v1`), puis se propage aux deux autres copies.
Script de sync à venir (Lot 1 gate) : `contracts/sync.mjs` (copie fichier par fichier + hash check).

> Note : `orchidy-pro/lib/contracts/launch-pro-events.ts` est un fichier **local à Pro**
> (imports `@/lib/events/...`) et ne fait PAS partie du paquet synchronisé.

## Contrats (V1)

| Fichier schéma | Producteur → Consommateur | Usage |
|---|---|---|
| `orky-trend-signal-v1.schema.json` | ORKY → Pro | Signal viral |
| `viral-sourcing-request-v1.schema.json` | ORKY → Pro | Requête de sourcing (embarque signal + candidats + conversion + vidéo) |
| `supplier-candidate-v1.schema.json` | Pro → ORKY | Candidat fournisseur |
| `orky-checkout-handoff-v1.schema.json` | ORKY → Orchidy | Handoff panier signé (HMAC), max 64 Ko |
| `orky-checkout-receipt-v1.schema.json` | Orchidy → ORKY | Reçu de checkout signé |
| `marketplace-order-paid-v1.schema.json` | Orchidy → Pro | Webhook « commande payée » (idempotent par `eventId`) |
| `viral-conversion-v1.schema.json` | Pro → ORKY | Conversion commerciale |
| `generated-commerce-video-v1.schema.json` | Pro → ORKY | État de vidéo générée |
| `orky-video-link-v1.schema.json` | ORKY → Pro | Lien vidéo publiée (contrat neuf) |
| `marketplace-fulfillment-event-v1.schema.json` | Orchidy ↔ Pro | Événement fulfillment (Lot 5/8) |

## Règles

- **Versionnage** : le suffixe `V1` fait partie du nom. Toute rupture (champ requis supprimé,
  type changé, sémantique modifiée) crée un fichier `-v2.schema.json` SANS modifier V1 :
  les consommateurs V1 continuent de fonctionner (partial regeneration / no-regression).
- **Ajout de champ** : optionnel uniquement ; les consommateurs V1 doivent l'ignorer.
- **Taille** : `orky-checkout-handoff-v1` plafonné à 64 Ko (routes existantes).
- **Idempotence** : `eventId`/`handoffId`/`eventId` identifiants uniques obligatoires là où
  précisé — jamais de double traitement (Lots 4–7).
- **Devise** : champ `currency` ISO-4217 (3 lettres) ; montants en **centimes**
  (`*Cents`) sauf `unitPrice`/`lineTotal`/`price` des candidats (alignés code existant).
- **Timestamps** : ISO-8601 (`format: date-time`).
- **Source** : `sourceApp: "orky"` sur le signal viral ; `authority` sur les événements fulfillment.

## Validation

- `v1/validate-json-schema.ts` : validateur JSON Schema zéro dépendance (sous-ensemble draft-07),
  utilisé par les consumer contract tests.
- `v1/fixtures/*.json` : un fixture valide par contrat, aligné sur le code réel.
- Tests consommateurs : `tests/contracts/consumer-contracts.test.ts` (Pro),
  `src/contracts/__tests__/consumer-contracts.test.ts` (Orchidy),
  `__tests__/contracts/consumer-contracts.test.ts` (ORKY).

## Gate Lot 1

Une PR qui casse un contrat consommé par une autre application doit échouer automatiquement :
les fixtures du producteur sont rejouées chez le consommateur à la CI (tests ci-dessus).