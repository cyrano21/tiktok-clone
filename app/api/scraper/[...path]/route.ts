import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERNAL_SCRAPER_URL = process.env.SCRAPER_API_INTERNAL_URL || 'http://127.0.0.1:8502';

function targetUrl(path: string[], request: Request): string {
  const suffix = path.join('/');
  const incoming = new URL(request.url);
  const query = incoming.search;
  return `${INTERNAL_SCRAPER_URL}/api/${suffix}${query}`;
}

export async function GET(
  request: Request,
  context: { params: { path: string[] } },
): Promise<Response> {
  const target = targetUrl(context.params.path, request);
  const isStream = context.params.path[0] === 'stream';

  try {
    const upstream = await fetch(target, {
      headers: {
        accept: request.headers.get('accept') || '*/*',
        range: request.headers.get('range') || '',
      },
      cache: isStream ? 'no-store' : 'no-store',
    });

    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    if (contentType) headers.set('content-type', contentType);
    if (contentLength) headers.set('content-length', contentLength);
    if (contentRange) headers.set('content-range', contentRange);
    headers.set('cache-control', isStream ? 'public, max-age=86400' : 'no-store');
    headers.set('access-control-allow-origin', '*');

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: 'Scraper service unavailable' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
