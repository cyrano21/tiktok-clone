import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Origine d'Orchidy Pro. En prod, définir NEXT_PUBLIC_ORCHIDY_PRO_URL
 *  (ex: https://pro.orchidy.fr). */
const PRO_BASE = String(
  process.env.ORCHIDY_PRO_API_URL ||
    process.env.NEXT_PUBLIC_ORCHIDY_PRO_URL ||
    'http://127.0.0.1:3100',
).replace(/\/$/, '');

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20; // sourcing = opération coûteuse
const hits = new Map<string, { count: number; resetAt: number }>();

function proApiKey(): string {
  const value = String(process.env.ORCHIDY_PRO_API_KEY || '').trim();
  if (!value) {
    throw new Error('ORCHIDY_PRO_API_KEY is not configured');
  }
  return value;
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

function consumeRate(key: string, max: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const current = hits.get(key);
  if (!current || current.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

function isAllowedPath(path: string[]): boolean {
  const joined = path.join('/');
  return (
    joined === 'requests' ||
    /^requests\/[A-Za-z0-9]{10,40}$/.test(joined) ||
    /^requests\/[A-Za-z0-9]{10,40}\/approve$/.test(joined)
  );
}

/** Résout l'origine du backend comme next.config : API_BACKEND_URL d'abord. */
function resolveBackendOrigin(): string {
  const raw =
    process.env.API_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://api:4000' : 'http://localhost:4000');
  return String(raw).replace(/\/$/, '').replace(/\/v1$/, '');
}

/** Le sourcing déclenche des appels fournisseurs coûteux (AliExpress/CJ) :
 *  exiger une session ORKY authentifiée (Bearer), vérifiée via /v1/auth/me. */
async function requireSession(request: NextRequest): Promise<{ ok: boolean; status?: number; error?: string }> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  try {
    const res = await fetch(`${resolveBackendOrigin()}/v1/auth/me`, {
      headers: { authorization: auth },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { ok: false, status: res.status === 401 ? 401 : 502, error: 'Session invalide' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: 'Backend indisponible' };
  }
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const session = await requireSession(request);
    if (!session.ok) {
      return NextResponse.json({ success: false, error: session.error }, { status: session.status ?? 401 });
    }
    const key = clientKey(request);
    const rate = consumeRate(key, RATE_MAX);
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'retry-after': String(rate.retryAfter) } });
    }
    const path = (params.path || []).map((p) => String(p));
    if (!isAllowedPath(path)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const upstream = await fetch(`${PRO_BASE}/api/viral-sourcing/${path.join('/')}`, {
      headers: { accept: 'application/json', 'x-api-key': proApiKey() },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.warn('[trends-sourcing-proxy] upstream unavailable', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Orchidy Pro indisponible' }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const session = await requireSession(request);
    if (!session.ok) {
      return NextResponse.json({ success: false, error: session.error }, { status: session.status ?? 401 });
    }
    const key = clientKey(request);
    const rate = consumeRate(key, RATE_MAX);
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'retry-after': String(rate.retryAfter) } });
    }
    const path = (params.path || []).map((p) => String(p));
    if (!isAllowedPath(path)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const raw = await request.text();
    const upstream = await fetch(`${PRO_BASE}/api/viral-sourcing/${path.join('/')}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-api-key': proApiKey(),
      },
      body: raw,
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000),
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.warn('[trends-sourcing-proxy] upstream unavailable', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Orchidy Pro indisponible' }, { status: 502 });
  }
}
