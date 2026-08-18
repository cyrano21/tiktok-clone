import { NextRequest, NextResponse } from 'next/server';
import { scraperUpstreamHeaders } from '../../../proxy-headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERNAL_SCRAPER_URL = process.env.SCRAPER_API_INTERNAL_URL || 'http://127.0.0.1:8502';
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function scraperSecret(): string {
  const value = String(process.env.SCRAPER_INTERNAL_SECRET || '').trim();
  if (!value) throw new Error('SCRAPER_INTERNAL_SECRET is not configured');
  return value;
}

/** Résout l'origine du backend comme next.config : API_BACKEND_URL d'abord,
 *  puis NEXT_PUBLIC_API_BASE_URL (sans suffixe /v1), puis localhost en dev. */
function resolveBackendOrigin(): string {
  const raw =
    process.env.API_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://api:4000' : 'http://localhost:4000');
  return String(raw).replace(/\/$/, '').replace(/\/v1$/, '');
}

/** Exige une session ORKY valide : l'approbation d'un produit sur le catalogue
 *  externe partagé est réservée aux utilisateurs connectés. */
async function requireUser(request: NextRequest): Promise<{ ok: boolean; status?: number; error?: string }> {
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
    if (res.status === 401) {
      return { ok: false, status: 401, error: 'Session invalide ou expirée' };
    }
    if (!res.ok) {
      return { ok: false, status: 502, error: 'Backend indisponible' };
    }
    const payload = (await res.json()) as { user?: unknown };
    if (!payload.user) {
      return { ok: false, status: 401, error: 'Session invalide' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: 'Backend indisponible' };
  }
}

async function forward(
  request: NextRequest,
  context: { params: { id: string } },
  method: 'POST' | 'DELETE',
): Promise<Response> {
  const id = context.params?.id;
  if (!ID_RE.test(id || '')) {
    return NextResponse.json({ error: 'Invalid video id' }, { status: 400 });
  }

  const user = await requireUser(request);
  if (!user.ok) {
    return NextResponse.json({ error: user.error }, { status: user.status ?? 403 });
  }

  const incoming = new URL(request.url);
  const upstream = `${INTERNAL_SCRAPER_URL.replace(/\/$/, '')}/api/videos/${encodeURIComponent(id)}/product-matches${incoming.search}`;
  const body = method === 'POST' ? await request.text() : undefined;

  try {
    const headers: Record<string, string> = {
      ...scraperUpstreamHeaders(request, scraperSecret()),
      ...(body !== undefined ? { 'content-type': request.headers.get('content-type') || 'application/json' } : {}),
    };
    const res = await fetch(upstream, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.warn('[scraper-product-matches] upstream unavailable', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Scraper service unavailable' },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest, context: { params: { id: string } }): Promise<Response> {
  return forward(request, context, 'POST');
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }): Promise<Response> {
  return forward(request, context, 'DELETE');
}
