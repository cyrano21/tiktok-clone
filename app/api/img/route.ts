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

export async function GET(request: NextRequest) {
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
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 });
  }
  const host = target.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith('.' + suffix),
  );
  if (!allowed) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      return new NextResponse(`Upstream error ${upstream.status}`, { status: upstream.status });
    }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 400 });
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': contentType,
        // Canvas CORS: le navigateur peut lire les pixels pour l'extraction
        // de la couleur dominante.
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 });
  }
}
