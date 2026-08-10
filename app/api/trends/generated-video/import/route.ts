import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const REQUEST_ID_RE = /^[A-Za-z0-9]{10,40}$/;

function proBase(): string {
  return String(
    process.env.ORCHIDY_PRO_API_URL ||
      process.env.NEXT_PUBLIC_ORCHIDY_PRO_URL ||
      'http://127.0.0.1:3100',
  ).replace(/\/$/, '');
}

function proApiKey(): string {
  const value = String(process.env.ORCHIDY_PRO_API_KEY || '').trim();
  if (!value) throw new Error('ORCHIDY_PRO_API_KEY is not configured');
  return value;
}

function delegationSecret(): string {
  const value = String(process.env.ORKY_PRO_DELEGATION_SECRET || '').trim();
  if (!value || (process.env.NODE_ENV === 'production' && value.length < 32)) {
    throw new Error('ORKY_PRO_DELEGATION_SECRET is not configured safely');
  }
  return value;
}

function commerceImportSecret(): string {
  const value = String(process.env.ORKY_COMMERCE_IMPORT_SECRET || '').trim();
  if (!value || (process.env.NODE_ENV === 'production' && value.length < 32)) {
    throw new Error('ORKY_COMMERCE_IMPORT_SECRET is not configured safely');
  }
  return value;
}

function backendOrigin(): string {
  const raw =
    process.env.API_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://api:4000' : 'http://localhost:4000');
  return String(raw).replace(/\/$/, '').replace(/\/v1$/, '');
}

function createDelegation(userId: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const claims = { sub: userId, aud: 'orchidy-pro', iat, exp: iat + 120 };
  const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', delegationSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

async function authenticate(request: NextRequest): Promise<{ authorization: string; userId: string } | null> {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${backendOrigin()}/v1/auth/me`, {
    headers: { authorization, accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({})) as { user?: { id?: unknown }; id?: unknown };
  const userId = String(payload.user?.id ?? payload.id ?? '').trim();
  return userId ? { authorization, userId } : null;
}

function proHeaders(userId: string) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-api-key': proApiKey(),
    'x-orky-delegation': createDelegation(userId),
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as { requestId?: unknown };
    const requestId = String(body.requestId || '').trim();
    if (!REQUEST_ID_RE.test(requestId)) {
      return NextResponse.json({ success: false, error: 'INVALID_REQUEST_ID' }, { status: 400 });
    }

    const sourcingResponse = await fetch(`${proBase()}/api/viral-sourcing/requests/${requestId}`, {
      headers: proHeaders(auth.userId),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const sourcingPayload = await sourcingResponse.json().catch(() => ({})) as any;
    if (!sourcingResponse.ok || !sourcingPayload?.request) {
      return NextResponse.json(
        { success: false, error: sourcingPayload?.error || 'SOURCING_REQUEST_UNAVAILABLE' },
        { status: sourcingResponse.status || 502 },
      );
    }

    const sourcing = sourcingPayload.request;
    const generated = sourcing.generatedVideo;
    if (generated?.orkyVideoId) {
      return NextResponse.json({ success: true, idempotent: true, videoId: generated.orkyVideoId });
    }
    if (generated?.status !== 'completed' || !generated?.hostedUrl || !generated?.jobId) {
      return NextResponse.json({ success: false, error: 'GENERATED_VIDEO_NOT_COMPLETED' }, { status: 409 });
    }
    const marketplaceProductId = String(sourcing.orchidyMarketplaceProductId || '').trim();
    if (!marketplaceProductId) {
      return NextResponse.json({ success: false, error: 'MARKETPLACE_PRODUCT_NOT_PUBLISHED' }, { status: 409 });
    }

    const importResponse = await fetch(`${backendOrigin()}/v1/commerce-imports/generated-video`, {
      method: 'POST',
      headers: {
        authorization: auth.authorization,
        accept: 'application/json',
        'content-type': 'application/json',
        'x-orky-commerce-import-secret': commerceImportSecret(),
      },
      body: JSON.stringify({
        sourceUrl: generated.hostedUrl,
        externalContentId: generated.jobId,
        sourceSignalId: sourcing.signal?.sourceSignalId,
        orchidyCatalogItemId: marketplaceProductId,
        title: sourcing.signal?.detectedProductName || 'Vidéo produit',
        description: sourcing.signal?.caption || '',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(180_000),
    });
    const importPayload = await importResponse.json().catch(() => ({})) as any;
    if (!importResponse.ok || !importPayload?.videoId) {
      return NextResponse.json(
        { success: false, error: importPayload?.error || 'ORKY_VIDEO_IMPORT_FAILED' },
        { status: importResponse.status || 502 },
      );
    }

    const linkResponse = await fetch(
      `${proBase()}/api/integrations/orky/viral-sourcing/${requestId}/video-link`,
      {
        method: 'POST',
        headers: proHeaders(auth.userId),
        body: JSON.stringify({ orkyVideoId: importPayload.videoId }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!linkResponse.ok) {
      // The ORKY import is idempotent by generated job id. A retry can safely
      // repair this cross-service link without producing a second video.
      return NextResponse.json(
        {
          success: false,
          recoverable: true,
          videoId: importPayload.videoId,
          error: 'PRO_VIDEO_LINK_FAILED',
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      idempotent: Boolean(importPayload.idempotent),
      videoId: importPayload.videoId,
      productMatchId: importPayload.productMatchId || null,
    });
  } catch (error) {
    console.warn('[generated-commerce-import] failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'GENERATED_COMMERCE_IMPORT_UNAVAILABLE' }, { status: 502 });
  }
}
