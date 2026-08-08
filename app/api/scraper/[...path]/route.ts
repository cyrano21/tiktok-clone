import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERNAL_SCRAPER_URL = process.env.SCRAPER_API_INTERNAL_URL || 'http://127.0.0.1:8502';
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const RATE_WINDOW_MS = 60_000;
const metadataHits = new Map<string, { count: number; resetAt: number }>();
const streamHits = new Map<string, { count: number; resetAt: number }>();

function scraperSecret(): string {
  const value = String(process.env.SCRAPER_INTERNAL_SECRET || '').trim();
  if (!value) throw new Error('SCRAPER_INTERNAL_SECRET is not configured');
  if (process.env.NODE_ENV === 'production' && value.length < 32) {
    throw new Error('SCRAPER_INTERNAL_SECRET is too weak');
  }
  return value;
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

function consumeRate(store: Map<string, { count: number; resetAt: number }>, key: string, max: number) {
  const now = Date.now();
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

function allowedPath(path: string[]): { ok: boolean; stream: boolean } {
  if (path.length === 1 && ['health', 'stats', 'videos'].includes(path[0])) {
    return { ok: true, stream: false };
  }
  if (path.length === 2 && path[0] === 'stream' && ID_RE.test(path[1])) {
    return { ok: true, stream: true };
  }
  if (path.length === 2 && path[0] === 'videos' && ID_RE.test(path[1])) {
    return { ok: true, stream: false };
  }
  if (path.length === 3 && path[0] === 'videos' && ID_RE.test(path[1]) && path[2] === 'comments') {
    return { ok: true, stream: false };
  }
  return { ok: false, stream: false };
}

function targetUrl(path: string[], request: Request): string {
  const suffix = path.map(encodeURIComponent).join('/');
  const incoming = new URL(request.url);
  return `${INTERNAL_SCRAPER_URL.replace(/\/$/, '')}/api/${suffix}${incoming.search}`;
}

export async function GET(
  request: NextRequest,
  context: { params: { path: string[] } },
): Promise<Response> {
  const path = Array.isArray(context.params.path) ? context.params.path : [];
  const permission = allowedPath(path);
  if (!permission.ok) {
    return NextResponse.json(
      { error: 'Scraper route not exposed' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  }

  const key = clientKey(request);
  const rate = consumeRate(permission.stream ? streamHits : metadataHits, key, permission.stream ? 20 : 120);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many scraper requests' },
      {
        status: 429,
        headers: { 'cache-control': 'no-store', 'retry-after': String(rate.retryAfter) },
      },
    );
  }

  try {
    const upstream = await fetch(targetUrl(path, request), {
      headers: {
        accept: request.headers.get('accept') || '*/*',
        ...(request.headers.get('range') ? { range: request.headers.get('range')! } : {}),
        'x-scraper-internal-secret': scraperSecret(),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(permission.stream ? 90_000 : 10_000),
    });

    const headers = new Headers();
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('cache-control', permission.stream ? 'private, max-age=3600' : 'no-store');
    headers.set('x-content-type-options', 'nosniff');

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.warn('[scraper-proxy] upstream unavailable', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Scraper service unavailable' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
