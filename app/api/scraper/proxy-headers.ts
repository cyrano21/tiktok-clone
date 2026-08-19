/** Header logic for the ORKY → scraper proxy.
 *
 * Traefik (the Coolify proxy in front of the scraper service) compresses
 * responses whenever the client sends `accept-encoding: gzip` — which Node's
 * undici `fetch` does by default. undici transparently decompresses the body,
 * but the `content-length` header still holds the *compressed* size. When a
 * proxy forwards both, downstream clients trust `content-length` and truncate
 * the body mid-JSON (observed: a 4568-byte payload cut to 1226 bytes, making
 * the scraper feed invalid and the ORKY feed empty).
 *
 * The fix is two-fold:
 * 1. Request `identity` encoding upstream so Traefik does not compress at all.
 * 2. Never forward `content-length`/`content-encoding` downstream — the
 *    proxied response is streamed with chunked transfer, so clients read to
 *    EOF regardless of what the upstream reported.
 */

export function scraperUpstreamHeaders(request: Request, secret: string): Record<string, string> {
  return {
    accept: request.headers.get('accept') || '*/*',
    // Prevent Traefik gzip: see module comment.
    'accept-encoding': 'identity',
    ...(request.headers.get('range') ? { range: request.headers.get('range')! } : {}),
    'x-scraper-internal-secret': secret,
  };
}

export function scraperResponseHeaders(upstream: { headers: Headers }, isStream: boolean): Headers {
  const headers = new Headers();
  // Never forward content-length/content-encoding: see module comment.
  for (const name of ['content-type', 'content-range', 'accept-ranges', 'etag']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Cache-Control navigateur/CDN : les médias servis par le scraper portent
  // déjà des directives publiques (images immutables 1j, vidéos 1h) — on les
  // transmet telles quelles. Métadonnées : jamais de cache.
  const upstreamCache = upstream.headers.get('cache-control');
  headers.set('cache-control', upstreamCache || (isStream ? 'private, max-age=3600' : 'no-store'));
  headers.set('x-content-type-options', 'nosniff');
  return headers;
}
