import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERNAL_SCRAPER_URL = process.env.SCRAPER_API_INTERNAL_URL || 'http://127.0.0.1:8502';
const REFRESH_SECRET = String(process.env.SCRAPER_INTERNAL_SECRET || '').trim();
// Vérification du rôle : même résolution que next.config — API_BACKEND_URL est
// la variable serveur qui alimente le proxy /v1 en production. On appelle
// directement le backend avec une URL absolue (un fetch relatif ne traverse pas
// les rewrites côté serveur).

// Régénération coûteuse (runs Apify) : 1 requête / 10 min, par utilisateur
// admin uniquement. Le rate limit est en mémoire (acceptable : l'autorisation
// admin est déjà requise — un attaquant non-admin est rejeté avant).
const RATE_WINDOW_MS = 10 * 60 * 1000;
const refreshHits = new Map<string, { count: number; resetAt: number }>();

/** Résout l'origine du backend comme next.config : API_BACKEND_URL d'abord,
 *  puis NEXT_PUBLIC_API_BASE_URL (sans suffixe /v1), puis localhost en dev. */
function resolveBackendOrigin(): string {
  const raw =
    process.env.API_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://api:4000' : 'http://localhost:4000');
  return String(raw).replace(/\/$/, '').replace(/\/v1$/, '');
}

function consumeRefreshRate(key: string, max: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const current = refreshHits.get(key);
  if (!current || current.resetAt <= now) {
    refreshHits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

interface MeUser {
  id: string;
  username: string;
  role?: string;
}

/** Vérifie que l'appelant est un admin ORKY authentifié (token Bearer). */
async function isAdminUser(request: NextRequest): Promise<{ ok: boolean; status?: number; error?: string }> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  try {
    const meUrl = `${resolveBackendOrigin()}/v1/auth/me`;
    const res = await fetch(meUrl, {
      headers: { authorization: auth },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401) {
      return { ok: false, status: 401, error: 'Session invalide ou expirée' };
    }
    if (!res.ok) {
      return { ok: false, status: 502, error: 'Backend indisponible' };
    }
    const payload = (await res.json()) as { user?: MeUser };
    if (!payload.user) {
      return { ok: false, status: 401, error: 'Session invalide' };
    }
    if (payload.user.role !== 'admin') {
      return { ok: false, status: 403, error: 'Administrateur requis' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: 'Backend indisponible' };
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!REFRESH_SECRET) {
    return NextResponse.json({ error: 'SCRAPER_INTERNAL_SECRET is not configured' }, { status: 500 });
  }

  // 1. Session ORKY + rôle admin (la garde principale contre l'abus public).
  const admin = await isAdminUser(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status ?? 403 });
  }

  let body: { confirm?: boolean; comments?: number } = {};
  try {
    body = (await request.json().catch(() => ({}))) as typeof body;
  } catch {
    body = {};
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: 'Confirmation required (confirm: true) — the refresh re-scrapes the catalog and costs Apify runs.' },
      { status: 400 },
    );
  }

  const key = clientKey(request);
  const rate = consumeRefreshRate(key, 1);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Refresh rate limit reached (1 per 10 minutes)' },
      { status: 429, headers: { 'retry-after': String(rate.retryAfter) } },
    );
  }

  try {
    const upstream = await fetch(`${INTERNAL_SCRAPER_URL.replace(/\/$/, '')}/api/admin/refresh`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'accept-encoding': 'identity',
        'x-scraper-internal-secret': REFRESH_SECRET,
      },
      body: JSON.stringify({ comments: typeof body.comments === 'number' ? body.comments : 6 }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.warn('[scraper-refresh] upstream unavailable', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Scraper service unavailable' },
      { status: 502 },
    );
  }
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}
