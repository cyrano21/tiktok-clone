import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Hosts autorisés : CDN produits Orchidy + sources de miniatures TikTok.
const ALLOWED_HOST_SUFFIXES = [
  'aliyuncs.com',
  'alicdn.com',
  'shopify.com',
  'cdn.shopify.com',
  'imgbb.com',
  'orchidy.fr',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'tiktokv.com',
  'byteimg.com',
  'tiktokcdn-in.com',
];

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
const MAX_REDIRECTS = 3;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120; // 120 requêtes / min / IP (extraction de couleurs = léger)

const hits = new Map<string, { count: number; resetAt: number }>();

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

function isHostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => h === suffix || h.endsWith('.' + suffix),
  );
}

export async function GET(request: NextRequest) {
  const key = clientKey(request);
  const rate = consumeRate(key, RATE_MAX);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'retry-after': String(rate.retryAfter) } },
    );
  }

  const url = request.nextUrl.searchParams.get('u') || request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing u parameter' }, { status: 400 });
  }
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // HTTPS uniquement (pas de contenu HTTP transitant par le proxy).
  if (target.protocol !== 'https:') {
    return NextResponse.json({ error: 'HTTPS only' }, { status: 400 });
  }
  if (!isHostAllowed(target.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
  }

  let current = target;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const upstream = await fetch(current.toString(), {
        cache: 'no-store',
        redirect: 'manual', // chaque redirection est validée avant d'être suivie
        signal: AbortSignal.timeout(15_000),
      });

      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get('location');
        if (!location) {
          return new NextResponse('Redirect without location', { status: 502 });
        }
        const next = new URL(location, current);
        // La redirection doit aussi être HTTPS + allowlistée.
        if (next.protocol !== 'https:' || !isHostAllowed(next.hostname)) {
          return NextResponse.json({ error: 'Redirect to disallowed host' }, { status: 403 });
        }
        current = next;
        continue;
      }

      if (!upstream.ok) {
        return new NextResponse(`Upstream error ${upstream.status}`, { status: upstream.status });
      }
      const contentType = upstream.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        return new NextResponse('Not an image', { status: 400 });
      }

      const declared = upstream.headers.get('content-length');
      if (declared && Number(declared) > MAX_BYTES) {
        return new NextResponse('Image too large', { status: 413 });
      }

      // Lecture bornée : on n'accepte jamais plus de 10 Mo, même si le CDN
      // ment sur content-length (chunked, gzip…).
      const reader = upstream.body?.getReader();
      if (!reader) {
        return new NextResponse('Empty body', { status: 502 });
      }
      const chunks: Buffer[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel().catch(() => undefined);
          return new NextResponse('Image too large', { status: 413 });
        }
        chunks.push(Buffer.from(value));
      }
      const body = Buffer.concat(chunks);

      return new NextResponse(body, {
        status: 200,
        headers: {
          'content-type': contentType,
          'content-length': String(body.length),
          // Canvas CORS: le navigateur peut lire les pixels pour l'extraction
          // de la couleur dominante.
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=3600, s-maxage=86400',
        },
      });
    }
    return NextResponse.json({ error: 'Too many redirects' }, { status: 502 });
  } catch {
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 });
  }
}
