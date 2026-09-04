# 01 — Contrats inter-applications canoniques (Lot 1)

Documentation complète : **source de vérité** dans `orchidy-pro/docs/integration-production/01-contracts.md`.
Copie locale du paquet : `src/contracts/v1/` (identique).

## Rôle d'ORKY dans le Lot 1

- **Producteur** de `OrkyTrendSignalV1`, `ViralSourcingRequestV1`, `OrkyCheckoutHandoffV1`
  et `OrkyVideoLinkV1` (ce dernier reste à implémenter côté émission).
- **Consommateur** de `OrkyCheckoutReceiptV1` (route `app/api/orchidy/checkout-return/verify`),
  `SupplierCandidateV1`, `ViralConversionV1`, `GeneratedCommerceVideoV1`.

## Consumer contract tests (ce dépôt)

`__tests__/contracts/consumer-contracts.test.ts` (jest) :

```
npm test -- __tests__/contracts/consumer-contracts.test.ts
```

- Le receipt d'Orchidy est accepté.
- Candidat/conversion/vidéo générée de Pro sont acceptés.
- Signal viral + sourcing request émis sont valides côté émetteur.
- Négatif : signature trop courte rejetée.

## Règles

Versionnage par suffixe `V1`/`V2` ; ajouts optionnels uniquement ; pas de dépendance runtime
(validateur zéro dépendance `src/contracts/v1/validate-json-schema.ts`).