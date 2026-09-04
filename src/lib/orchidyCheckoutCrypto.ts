/**
 * Crypto du protocole ORKY → Orchidy (PLAN-ORCHIDS Lot 6).
 *
 * Les deux sens du protocole sont centralisés ici pour être testables et pour
 * garantir la conformité avec le vérificateur d'Orchidy :
 *
 * 1. Handoff ORKY → Orchidy : signature HMAC-SHA256 sur
 *    `${timestampSecondes}.${nonce}.${rawBody}` — timestamp en SECONDES
 *    (tolérance d'horloge ±5 min côté Orchidy), nonce base64url ≥ 16 car.,
 *    nonce régénéré à chaque tentative (un replay signé échoue au claim
 *    unique côté Orchidy).
 *
 * 2. Receipt Orchidy → ORKY (`r1.${encoded}.${signature}`) : HMAC-SHA256 sur
 *    `orky-return.${encoded}`. ORKY ne fait JAMAIS confiance à un receipt
 *    sans signature valide ni sans fenêtre d'expiration (24 h).
 */

import crypto from 'node:crypto';

const SECRET_ENV = 'ORKY_CHECKOUT_HANDOFF_SECRET';
const NONCE_RE = /^[A-Za-z0-9:_-]{16,120}$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const SHA256_RE = /^[a-f\d]{64}$/i;
/** Miroir du TTL des receipts côté Orchidy (24 h). */
const RECEIPT_TTL_SECONDS = 24 * 60 * 60;
/** Skew toléré pour les receipts fraîchement émis (5 min dans le futur). */
const MAX_FUTURE_SKEW_SECONDS = 300;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function timingSafeHexEqual(left: string, right: string): boolean {
  if (!SHA256_RE.test(left) || !SHA256_RE.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function requireOrchidyHandoffSecret(): string {
  const value = text(process.env[SECRET_ENV], 1_024);
  if (!value) throw new Error('ORKY_CHECKOUT_HANDOFF_SECRET is not configured');
  if (process.env.NODE_ENV === 'production' && value.length < 32) {
    throw new Error('ORKY_CHECKOUT_HANDOFF_SECRET is too weak');
  }
  return value;
}

function sign(prefix: string, encoded: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${prefix}.${encoded}`, 'utf8').digest('hex');
}

export type OrchidyHandoffHeaders = {
  'x-orky-timestamp': string;
  'x-orky-nonce': string;
  'x-orky-signature': string;
};

/**
 * Signe un handoff exactement comme le vérificateur d'Orchidy l'attend :
 * timestamp en secondes, nonce aléatoire conforme, HMAC sur
 * `${timestamp}.${nonce}.${rawBody}`.
 */
export function buildOrchidyHandoffHeaders(input: {
  rawBody: string;
  now?: Date;
  nonce?: string;
  secret?: string;
}): OrchidyHandoffHeaders {
  const secret = input.secret || requireOrchidyHandoffSecret();
  const now = input.now || new Date();
  const timestamp = String(Math.floor(now.getTime() / 1_000));
  const nonce =
    input.nonce ||
    crypto.randomBytes(24).toString('base64url').slice(0, 120);
  if (!NONCE_RE.test(nonce)) throw new Error('invalid nonce');
  const signature = sign(timestamp, `${nonce}.${input.rawBody}`, secret);
  return {
    'x-orky-timestamp': timestamp,
    'x-orky-nonce': nonce,
    'x-orky-signature': signature,
  };
}

export type VerifiedOrchidyReceipt = {
  status: 'paid' | 'cancelled';
  handoffId: string;
  checkoutId: string;
  iat: number;
  exp: number;
};

/**
 * Vérifie un receipt Orchidy. Refuse : format invalide, signature falsifiée
 * (scénario 10), receipt expiré (scénario 11), payload invalide.
 */
export function verifyOrchidyReceipt(
  raw: unknown,
  options: { now?: Date; secret?: string } = {},
): VerifiedOrchidyReceipt {
  const value = text(raw, 4_096);
  const [version, encoded, signature, extra] = value.split('.');
  if (version !== 'r1' || !encoded || !signature || extra) {
    throw new Error('INVALID_RECEIPT');
  }
  const secret = options.secret || requireOrchidyHandoffSecret();
  const expected = sign('orky-return', encoded, secret);
  if (!timingSafeHexEqual(signature, expected)) {
    throw new Error('INVALID_RECEIPT_SIGNATURE');
  }

  let payload: {
    v?: unknown;
    handoffId?: unknown;
    checkoutId?: unknown;
    status?: unknown;
    iat?: unknown;
    exp?: unknown;
  };
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new Error('INVALID_RECEIPT_PAYLOAD');
  }

  const nowSeconds = Math.floor((options.now || new Date()).getTime() / 1_000);
  if (
    payload?.v !== 1 ||
    !OBJECT_ID_RE.test(text(payload.handoffId, 64)) ||
    !/^[A-Za-z0-9:_-]{12,180}$/.test(text(payload.checkoutId, 180)) ||
    !['paid', 'cancelled'].includes(String(payload.status)) ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    Number(payload.exp) <= nowSeconds ||
    Number(payload.iat) > nowSeconds + MAX_FUTURE_SKEW_SECONDS
  ) {
    throw new Error('INVALID_RECEIPT_PAYLOAD');
  }
  return {
    status: payload.status as 'paid' | 'cancelled',
    handoffId: String(payload.handoffId),
    checkoutId: String(payload.checkoutId),
    iat: Number(payload.iat),
    exp: Number(payload.exp),
  };
}

/** Fabrique un receipt valide (utilisé par les tests de conformité). */
export function createTestOrchidyReceipt(input: {
  handoffId: string;
  checkoutId: string;
  status: 'paid' | 'cancelled';
  secret: string;
  now?: Date;
  expOverrideSeconds?: number;
}): string {
  const nowSeconds = Math.floor((input.now || new Date()).getTime() / 1_000);
  const payload = {
    v: 1,
    handoffId: input.handoffId,
    checkoutId: input.checkoutId,
    status: input.status,
    iat: nowSeconds,
    exp:
      input.expOverrideSeconds !== undefined
        ? input.expOverrideSeconds
        : nowSeconds + RECEIPT_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `r1.${encoded}.${sign('orky-return', encoded, input.secret)}`;
}
