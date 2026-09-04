# 06 — Lot 6 : Protocole ORKY → Orchidy (moitié ORKY)

> PLAN-ORCHIDS — Lot 6, terminé côté ORKY le 2026-09-03.
> Objectif : prouver que le protocole signé ORKY → Orchidy est conforme et que
> les receipts Orchidy ne sont jamais trustés sans signature + expiration.

## Ce qui existait

- Proxy signé `app/api/orchidy/checkout-handoff/route.ts` : construisait les
  headers HMAC **inline** (aucun test direct, aucune garantie de conformité).
- `app/api/orchidy/checkout-return/verify/route.ts` : vérifiait le receipt
  Orchidy **inline** (aucun test : falsification / expiration non prouvées).

## Ce qui a été ajouté

### `src/lib/orchidyCheckoutCrypto.ts` — crypto du protocole, testable

- `buildOrchidyHandoffHeaders({ rawBody })` — signe le handoff au format
  EXACT du vérificateur Orchidy : timestamp en secondes (skew ±5 min),
  nonce base64url frais à chaque appel, HMAC-SHA256 sur
  `${timestamp}.${nonce}.${rawBody}`.
- `verifyOrchidyReceipt(receipt)` — vérifie `r1.${encoded}.${signature}`
  (HMAC sur `orky-return.${encoded}`) : format, signature timing-safe,
  payload, **expiration** (24 h) et skew futur ≤ 5 min.
- `createTestOrchidyReceipt(...)` — fabrique des receipts valides (tests).
- Les deux routes délèguent désormais à ce module (aucun changement de
  comportement : mêmes headers, mêmes statuts/erreurs).

## Matrice de scénarios — couverture ORKY

| # | Scénario | Couverture | Preuve |
|---|---|---|---|
| 8 | Signature HMAC invalide | ✅ | `__tests__/orchidy-checkout-crypto.test.ts` : headers conformes aux contraintes du vérificateur Orchidy ; corps modifié ⇒ signature différente (rejetée serveur) ; nonce frais à chaque tentative |
| 10 | Receipt falsifié | ✅ | idem : payload altéré avec signature d'origine ⇒ `INVALID_RECEIPT_SIGNATURE` ; mauvais secret ⇒ rejet |
| 11 | Receipt expiré | ✅ | idem : `exp` passé ⇒ `INVALID_RECEIPT_PAYLOAD` ; format invalide rejeté |
| 12/13 | Paiement annulé / réussi | ✅ | receipts `cancelled` et `paid` valides acceptés (statut net) |
| 14 | Double retour navigateur | ✅ | couvert par les suites existantes `cart-handoff-reconciliation` + réconciliation locale du panier |
| 15 | Plusieurs onglets | ✅ | base multi-onglets existante dans ORKY (le plan la juge « particulièrement correcte ») — non dupliquée ici |
| 16 | Ajout d'un article pendant le checkout | ✅/⚠️ | réconciliation panier (`cart-handoff-reconciliation.test.ts`) ; le serveur fige le panier validé au handoff |

## Preuves exécutées

```text
npm test -- --runInBand __tests__/orchidy-checkout-crypto.test.ts
→ 9 passed

npm run typecheck → exit 0
```

## Limitations

- Les routes Next (`next/server`) ne sont pas importées dans jest : la
  conformité est prouvée au niveau module crypto pur, pas par injection HTTP
  de la route — comportement route inchangé (même logique déléguée).
- E2E « vraies applications déployées » : `NOT_RUN` (pas de déploiement ici).
- Le handoff lui-même (round-trip complet avec Orchidy) est couvert par les
  suites Orchidy (`orkyCheckoutHandoff.test.ts`, protocole + catalogue) et par
  la conformité croisée des formats ci-dessus.