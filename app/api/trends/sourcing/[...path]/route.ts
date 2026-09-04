import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { consumeRate, costForOperation } from '@/lib/rateLimit/redisRateLimiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRO_BASE = String(
  process.env.ORCHIDY_PRO_API_URL ||
    process.env.NEXT_PUBLIC_ORCHIDY_PRO_URL ||
    'http://127.0.0.1:3100',
).replace(/\/$/, '');

const MAX_BODY_BYTES = 64 * 1024;

function proApiKey(): string {
  const value = String(process.env.ORCHIDY_PRO_API_KEY || '').trim();
  if (!value || (process.env.NODE_ENV === 'production' && value.length < 24)) {
    throw new Error('ORCHIDY_PRO_API_KEY is not configured safely');
  }
  return value;
}

function delegationSecret(): string {
  const value = String(process.env.ORKY_PRO_DELEGATION_SECRET || '').trim();
  if (!value || (process.env.NODE_ENV === 'production' && value.length < 32)) {
    throw new Error('ORKY_PRO_DELEGATION_SECRET is not configured safely');
  }
  return value;
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createDelegation(userId: string): string {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) throw new Error('Authenticated ORKY user id is missing');
  const iat = Math.floor(Date.now() / 1000);
  const claims = { sub: normalizedUserId, aud: 'orchidy-pro', iat, exp: iat + 120 };
  const encoded = encode(claims);
  const signature = createHmac('sha256', delegationSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

function isAllowedPath(path: string[]): boolean {
  const joined = path.join('/');
  return (
    joined === 'requests' ||
    /^requests\/[A-Za-z0-9]{10,40}$/.test(joined) ||
    /^requests\/[A-Za-z0-9]{10,40}\/approve$/.test(joined) ||
    /^requests\/[A-Za-z0-9]{10,40}\/generate-video$/.test(joined)
  );
}

function resolveBackendOrigin(): string {
  const raw =
    process.env.API_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://api:4000' : 'http://localhost:4000');
  return String(raw).replace(/\/$/, '').replace(/\/v1$/, '');
}

async function requireSession(request: NextRequest): Promise<{ ok: boolean; userId?: string; status?: number; error?: string }> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  try {
    const response = await fetch(`${resolveBackendOrigin()}/v1/auth/me`, {
      headers: { authorization: auth },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return { ok: false, status: response.status === 401 ? 401 : 502, error: 'Session invalide' };
    }
    const payload = await response.json().catch(() => ({})) as { user?: { id?: unknown }; id?: unknown };
    const userId = String(payload.user?.id ?? payload.id ?? '').trim();
    if (!userId) return { ok: false, status: 502, error: 'Identité utilisateur indisponible' };
    return { ok: true, userId };
  } catch {
    return { ok: false, status: 502, error: 'Backend indisponible' };
  }
}

function commonHeaders(userId: string) {
  return {
    accept: 'application/json',
    'x-api-key': proApiKey(),
    'x-orky-delegation': createDelegation(userId),
  };
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const session = await requireSession(request);
    if (!session.ok || !session.userId) {
      return NextResponse.json({ success: false, error: session.error }, { status: session.status ?? 401 });
    }
    const path = (params.path || []).map(String);
    if (!isAllowedPath(path)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Lot 4 : rate limiting Redis partagé (user + IP + sourcing), coût 1 en GET.
    const rate = await consumeRate(
      { userId: session.userId, ip: clientKey(request) },
      costForOperation('GET', path),
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded', failingBucket: rate.failingBucket }, { status: 429, headers: { 'retry-after': String(rate.retryAfter) } });
    }

    const upstream = await fetch(
      `${PRO_BASE}/api/viral-sourcing/${path.join('/')}${request.nextUrl.search || ''}`,
      {
        headers: commonHeaders(session.userId),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      },
    );
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    console.warn('[trends-sourcing-proxy] upstream unavailable', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Orchidy Pro indisponible' }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const session = await requireSession(request);
    if (!session.ok || !session.userId) {
      return NextResponse.json({ success: false, error: session.error }, { status: session.status ?? 401 });
    }
    const path = (params.path || []).map(String);
    if (!isAllowedPath(path)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Lot 4 : coût pondéré selon l'opération (create=5, approve=10, vidéo=20).
    const rate = await consumeRate(
      { userId: session.userId, ip: clientKey(request) },
      costForOperation('POST', path),
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded', failingBucket: rate.failingBucket }, { status: 429, headers: { 'retry-after': String(rate.retryAfter) } });
    }

    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const upstream = await fetch(
      `${PRO_BASE}/api/viral-sourcing/${path.join('/')}${request.nextUrl.search || ''}`,
      {
        method: 'POST',
        headers: {
          ...commonHeaders(session.userId),
          'content-type': 'application/json',
        },
        body: raw,
        cache: 'no-store',
        // POSTs now enqueue expensive work; they must return quickly.
        signal: AbortSignal.timeout(20_000),
      },
    );
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    console.warn('[trends-sourcing-proxy] upstream unavailable', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Orchidy Pro indisponible' }, { status: 502 });
  }
}
