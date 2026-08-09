import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERNAL_SCRAPER_URL = process.env.SCRAPER_API_INTERNAL_URL || 'http://127.0.0.1:8502';
const REFRESH_SECRET = String(process.env.SCRAPER_INTERNAL_SECRET || '').trim();

// Régénération coûteuse (runs Apify) : fenêtre stricte d'1 requête / 10 min.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const refreshHits = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
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

export async function POST(request: NextRequest): Promise<Response> {
  if (!REFRESH_SECRET) {
    return NextResponse.json({ error: 'SCRAPER_INTERNAL_SECRET is not configured' }, { status: 500 });
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
