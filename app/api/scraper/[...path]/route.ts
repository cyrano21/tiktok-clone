import { NextRequest, NextResponse } from 'next/server';
import { scraperUpstreamHeaders, scraperResponseHeaders } from '../proxy-headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERNAL_SCRAPER_URL = process.env.SCRAPER_API_INTERNAL_URL || 'http://127.0.0.1:8502';
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
// Clés médias (ids son, usernames TikTok) : les usernames peuvent contenir des points.
const KEY_RE = /^[A-Za-z0-9._-]{1,128}$/;
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
  if (path.length === 2 && path[0] === 'admin' && (path[1] === 'refresh-status' || path[1] === 'warm')) {
    return { ok: true, stream: path[1] === 'warm' };
  }
  if (path.length === 2 && path[0] === 'stream' && ID_RE.test(path[1])) {
    return { ok: true, stream: true };
  }
  // Covers son + avatars : URLs TikTok signées (TTL court, validées par IP) —
  // le scraper les télécharge côté serveur et les sert depuis son cache local.
  if (path.length === 2 && path[0] === 'sound-cover' && KEY_RE.test(path[1])) {
    return { ok: true, stream: true };
  }
  if (path.length === 2 && path[0] === 'avatar' && KEY_RE.test(path[1])) {
    return { ok: true, stream: true };
  }
  // Thumbnail proxy: le navigateur ne doit jamais charger une URL TikTok signée
  // (TTL court, validée par IP) — la miniature passe par le scraper qui la
  // télécharge fraîchement côté serveur. Traitée comme un stream (timeout long).
  if (path.length === 2 && path[0] === 'thumbnail' && ID_RE.test(path[1])) {
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
      headers: scraperUpstreamHeaders(request, scraperSecret()),
      cache: 'no-store',
      signal: AbortSignal.timeout(permission.stream ? 90_000 : 10_000),
    });

    const headers = scraperResponseHeaders(upstream, permission.stream);

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
