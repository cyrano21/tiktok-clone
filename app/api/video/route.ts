import { NextRequest } from 'next/server';

const ALLOWED_HOSTS = [
  'test-videos.co.uk',
  'media.w3.org',
  'archive.org',
  'dn801203.us.archive.org',
];

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  const isAllowed = ALLOWED_HOSTS.some(
    (host) => targetUrl.hostname === host || targetUrl.hostname.endsWith('.' + host)
  );
  if (!isAllowed) {
    return new Response('Host not allowed', { status: 403 });
  }

  const range = request.headers.get('range');

  try {
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; VideoProxy/1.0)',
    };
    if (range) {
      fetchHeaders['Range'] = range;
    }

    const response = await fetch(targetUrl.toString(), { headers: fetchHeaders });

    if (!response.ok && response.status !== 206) {
      return new Response(`Upstream returned ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'video/mp4';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=3600');
    if (contentLength) headers.set('Content-Length', contentLength);
    if (contentRange) headers.set('Content-Range', contentRange);

    return new Response(response.body, {
      status: response.status === 206 ? 206 : 200,
      headers,
    });
  } catch (error) {
    return new Response('Failed to fetch video', { status: 502 });
  }
}
