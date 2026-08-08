import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;

type HandoffItem = {
  productId: string;
  variantKey?: string;
  quantity: number;
  selectedOptions?: Record<string, string>;
};

function text(value: unknown, max = 2_048): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function secret(): string {
  const value = text(process.env.ORKY_CHECKOUT_HANDOFF_SECRET, 1_024);
  if (!value) throw new Error('ORKY_CHECKOUT_HANDOFF_SECRET is not configured');
  if (process.env.NODE_ENV === 'production' && value.length < 32) {
    throw new Error('ORKY_CHECKOUT_HANDOFF_SECRET is too weak');
  }
  return value;
}

function orchidyBaseUrl(): string {
  return (
    process.env.ORCHIDY_API_BASE_URL ||
    process.env.NEXT_PUBLIC_ORCHIDY_BASE_URL ||
    'https://orchidy.fr'
  ).replace(/\/$/, '');
}

function sanitizeSelectedOptions(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, raw]) => [String(key).trim(), String(raw).trim()] as const)
    .filter(([key, raw]) => key && raw)
    .slice(0, 20);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function parseItems(value: unknown): HandoffItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    throw new Error('Le panier doit contenir entre 1 et 50 lignes.');
  }
  const seen = new Set<string>();
  return value.map((entry) => {
    const raw = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? (entry as Record<string, unknown>)
      : {};
    const productId = text(raw.productId, 300);
    const variantKey = text(raw.variantKey, 300) || undefined;
    const quantity = Number(raw.quantity);
    if (!productId) throw new Error('Identifiant produit Orchidy manquant.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 25) {
      throw new Error('Quantité invalide.');
    }
    const identity = `${productId}::${variantKey || 'base'}`;
    if (seen.has(identity)) throw new Error('Ligne de panier dupliquée.');
    seen.add(identity);
    return {
      productId,
      variantKey,
      quantity,
      selectedOptions: sanitizeSelectedOptions(raw.selectedOptions),
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const declaredLength = Number(request.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: 'Panier trop volumineux.' }, { status: 413 });
    }

    const incoming = await request.json().catch(() => ({})) as Record<string, unknown>;
    const items = parseItems(incoming.items);
    const returnUrl = text(incoming.returnUrl) || request.nextUrl.origin;
    let safeReturnUrl: string;
    try {
      const parsed = new URL(returnUrl, request.nextUrl.origin);
      if (parsed.origin !== request.nextUrl.origin) throw new Error('cross-origin returnUrl');
      safeReturnUrl = parsed.toString();
    } catch {
      return NextResponse.json({ success: false, error: 'URL de retour ORKY invalide.' }, { status: 400 });
    }

    const body = JSON.stringify({ items, source: 'ORKY', returnUrl: safeReturnUrl });
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: 'Panier trop volumineux.' }, { status: 413 });
    }

    const timestamp = String(Math.floor(Date.now() / 1_000));
    const nonce = crypto.randomBytes(24).toString('base64url');
    const signature = crypto
      .createHmac('sha256', secret())
      .update(`${timestamp}.${nonce}.${body}`, 'utf8')
      .digest('hex');

    const upstream = await fetch(`${orchidyBaseUrl()}/api/integrations/orky/checkout-handoff`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-orky-timestamp': timestamp,
        'x-orky-nonce': nonce,
        'x-orky-signature': signature,
      },
      body,
      cache: 'no-store',
    });
    const payload = await upstream.json().catch(() => ({
      success: false,
      error: 'Réponse Orchidy invalide.',
    }));

    return NextResponse.json(payload, {
      status: upstream.status,
      headers: {
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[orchidy-checkout-handoff] proxy failed', error);
    return NextResponse.json(
      {
        success: false,
        code: 'ORCHIDY_HANDOFF_UNAVAILABLE',
        error: error instanceof Error ? error.message : 'Le checkout Orchidy est indisponible.',
      },
      { status: 502, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }
}
