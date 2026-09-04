import { NextRequest, NextResponse } from 'next/server';
import { buildOrchidyHandoffHeaders, requireOrchidyHandoffSecret } from '@/lib/orchidyCheckoutCrypto';

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
  return requireOrchidyHandoffSecret();
}

function orchidyBaseUrl(): string {
  return (
    process.env.ORCHIDY_API_BASE_URL ||
    process.env.NEXT_PUBLIC_ORCHIDY_BASE_URL ||
    'https://orchidy.fr'
  ).replace(/\/$/, '');
}

async function readBoundedJson(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') throw new Error('INVALID_CONTENT_TYPE');

  const declared = request.headers.get('content-length');
  if (declared) {
    const size = Number(declared);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_BODY_BYTES) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('INVALID_JSON');
  }
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
    const incoming = await readBoundedJson(request);
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

    const headers = buildOrchidyHandoffHeaders({ rawBody: body, now: new Date() });

    const upstream = await fetch(`${orchidyBaseUrl()}/api/integrations/orky/checkout-handoff`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...headers,
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
    const message = error instanceof Error ? error.message : 'Le checkout Orchidy est indisponible.';
    if (message === 'PAYLOAD_TOO_LARGE') {
      return NextResponse.json({ success: false, error: 'Panier trop volumineux.' }, { status: 413 });
    }
    if (message === 'INVALID_JSON' || message === 'INVALID_CONTENT_TYPE') {
      return NextResponse.json({ success: false, error: 'Requête de checkout invalide.' }, { status: 400 });
    }
    console.error('[orchidy-checkout-handoff] proxy failed', error);
    return NextResponse.json(
      {
        success: false,
        code: 'ORCHIDY_HANDOFF_UNAVAILABLE',
        error: message,
      },
      { status: 502, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }
}
