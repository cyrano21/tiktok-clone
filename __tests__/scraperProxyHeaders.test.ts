import {
  scraperUpstreamHeaders,
  scraperResponseHeaders,
} from '../app/api/scraper/proxy-headers';

describe('scraper proxy header handling', () => {
  it('requests identity encoding upstream so Traefik never gzips', () => {
    const request = {
      headers: new Headers({ accept: 'application/json' }),
    } as unknown as Request;
    const headers = scraperUpstreamHeaders(request, 'top-secret');
    expect(headers['accept-encoding']).toBe('identity');
    expect(headers['x-scraper-internal-secret']).toBe('top-secret');
    expect(headers.accept).toBe('application/json');
  });

  it('never forwards content-length or content-encoding downstream', () => {
    // Simulate an upstream whose headers lie about the body size (the exact
    // failure mode seen in production: Traefik gzip + undici auto-decompress).
    const upstream = {
      headers: new Headers({
        'content-type': 'application/json; charset=utf-8',
        'content-length': '1226',
        'content-encoding': 'gzip',
        'content-range': 'bytes 0-99/4568',
        'accept-ranges': 'bytes',
        etag: '"abc"',
      }),
    };

    const headers = scraperResponseHeaders(upstream, false);
    expect(headers.get('content-length')).toBeNull();
    expect(headers.get('content-encoding')).toBeNull();
    expect(headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(headers.get('etag')).toBe('"abc"');
    expect(headers.get('accept-ranges')).toBe('bytes');
    expect(headers.get('cache-control')).toBe('no-store');
  });
});
