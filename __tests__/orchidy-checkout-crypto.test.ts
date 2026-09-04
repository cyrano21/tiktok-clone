import crypto from 'node:crypto';

import {
  buildOrchidyHandoffHeaders,
  createTestOrchidyReceipt,
  verifyOrchidyReceipt,
} from '../src/lib/orchidyCheckoutCrypto';

const SECRET = 'test-orky-handoff-secret-that-is-long-enough-123456';
const HANDOFF_ID = '66b5d1f0e4c44b1baf000001';
const CHECKOUT_ID = 'cs_test_abcd1234';

/**
 * PLAN-ORCHIDS Lot 6 — conformité du protocole côté ORKY.
 * Les formats générés ici doivent être EXACTEMENT ceux que le vérificateur
 * d'Orchidy accepte (sinon le handoff échoue en 401 en production).
 */

/** Miroir strict des contraintes du vérificateur Orchidy. */
function orchidyVerifierConstraints(headers: Record<string, string>) {
  const unixSeconds = Number(headers['x-orky-timestamp']);
  const nowSeconds = Math.floor(Date.now() / 1000);
  expect(Number.isInteger(unixSeconds)).toBe(true);
  expect(Math.abs(nowSeconds - unixSeconds)).toBeLessThanOrEqual(300);
  expect(headers['x-orky-nonce']).toMatch(/^[A-Za-z0-9:_-]{16,120}$/);
  expect(headers['x-orky-signature']).toMatch(/^[a-f0-9]{64}$/i);
}

describe('Handoff ORKY → Orchidy : signature canonique (scénario 8)', () => {
  const rawBody = JSON.stringify({
    source: 'ORKY',
    items: [{ productId: 'catalog-product-1', quantity: 2 }],
  });

  it('produit des headers que le vérificateur Orchidy acceptera (secondes + nonce + HMAC canonique)', () => {
    const headers = buildOrchidyHandoffHeaders({ rawBody, now: new Date(), secret: SECRET });
    orchidyVerifierConstraints(headers);

    // Le vérificateur Orchidy recalcule HMAC(`${ts}.${nonce}.${rawBody}`).
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${headers['x-orky-timestamp']}.${headers['x-orky-nonce']}.${rawBody}`, 'utf8')
      .digest('hex');
    expect(headers['x-orky-signature']).toBe(expected);
  });

  it('chaque appel génère un nonce frais (replay impossible)', () => {
    const first = buildOrchidyHandoffHeaders({ rawBody, secret: SECRET });
    const second = buildOrchidyHandoffHeaders({ rawBody, secret: SECRET });
    expect(first['x-orky-nonce']).not.toBe(second['x-orky-nonce']);
    expect(first['x-orky-signature']).not.toBe(second['x-orky-signature']);
  });

  it('une signature refaite sur un corps modifié diffère (le serveur la rejettera)', () => {
    const original = buildOrchidyHandoffHeaders({ rawBody, secret: SECRET });
    const tampered = buildOrchidyHandoffHeaders({
      rawBody: rawBody.replace('"quantity":2', '"quantity":3'),
      secret: SECRET,
      nonce: original['x-orky-nonce'],
    });
    expect(tampered['x-orky-signature']).not.toBe(original['x-orky-signature']);
  });
});

describe('Receipt Orchidy → ORKY (scénarios 10 & 11)', () => {
  it('accepte un receipt paid valide', () => {
    const receipt = createTestOrchidyReceipt({
      handoffId: HANDOFF_ID,
      checkoutId: CHECKOUT_ID,
      status: 'paid',
      secret: SECRET,
    });
    expect(verifyOrchidyReceipt(receipt, { secret: SECRET })).toMatchObject({
      status: 'paid',
      handoffId: HANDOFF_ID,
      checkoutId: CHECKOUT_ID,
    });
  });

  it('accepte un receipt cancelled valide (paiement annulé → statut net)', () => {
    const receipt = createTestOrchidyReceipt({
      handoffId: HANDOFF_ID,
      checkoutId: CHECKOUT_ID,
      status: 'cancelled',
      secret: SECRET,
    });
    expect(verifyOrchidyReceipt(receipt, { secret: SECRET }).status).toBe('cancelled');
  });

  it('refuse un receipt falsifié (scénario 10)', () => {
    const receipt = createTestOrchidyReceipt({
      handoffId: HANDOFF_ID,
      checkoutId: CHECKOUT_ID,
      status: 'paid',
      secret: SECRET,
    });
    // Alters the payload: paid → cancelled, keeping the original signature.
    const parts = receipt.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        v: 1,
        handoffId: HANDOFF_ID,
        checkoutId: CHECKOUT_ID,
        status: 'cancelled',
        iat: Math.floor(Date.now() / 1000) - 10,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      'utf8',
    ).toString('base64url');
    const falsified = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    expect(() => verifyOrchidyReceipt(falsified, { secret: SECRET })).toThrow(
      'INVALID_RECEIPT_SIGNATURE',
    );
  });

  it('refuse un receipt signé avec un autre secret', () => {
    const receipt = createTestOrchidyReceipt({
      handoffId: HANDOFF_ID,
      checkoutId: CHECKOUT_ID,
      status: 'paid',
      secret: 'a-different-secret-that-is-also-long-123456',
    });
    expect(() => verifyOrchidyReceipt(receipt, { secret: SECRET })).toThrow(
      'INVALID_RECEIPT_SIGNATURE',
    );
  });

  it('refuse un receipt expiré (scénario 11)', () => {
    const expired = Math.floor(Date.now() / 1000) - 10;
    const receipt = createTestOrchidyReceipt({
      handoffId: HANDOFF_ID,
      checkoutId: CHECKOUT_ID,
      status: 'paid',
      secret: SECRET,
      expOverrideSeconds: expired,
    });
    expect(() => verifyOrchidyReceipt(receipt, { secret: SECRET })).toThrow(
      'INVALID_RECEIPT_PAYLOAD',
    );
  });

  it('refuse un receipt au format invalide', () => {
    expect(() => verifyOrchidyReceipt('r1.garbage', { secret: SECRET })).toThrow();
    expect(() => verifyOrchidyReceipt('', { secret: SECRET })).toThrow('INVALID_RECEIPT');
  });
});
