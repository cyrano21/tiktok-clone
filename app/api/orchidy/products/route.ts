import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ProductResponse = Record<string, unknown>;

function resolveOrchidyBaseUrl() {
  const raw =
    process.env.ORCHIDY_API_BASE_URL ||
    process.env.NEXT_PUBLIC_ORCHIDY_BASE_URL ||
    'https://orchidy.fr';
  return raw.replace(/\/$/, '');
}

function copySearchParam(source: URLSearchParams, target: URLSearchParams, key: string) {
  const value = source.get(key);
  if (value !== null && value !== '') target.set(key, value);
}

function buildUpstream(incoming: URLSearchParams, endpoint: string) {
  const upstream = new URL(endpoint, resolveOrchidyBaseUrl());
  copySearchParam(incoming, upstream.searchParams, 'q');
  copySearchParam(incoming, upstream.searchParams, 'category');
  copySearchParam(incoming, upstream.searchParams, 'market');
  copySearchParam(incoming, upstream.searchParams, 'localityId');
  copySearchParam(incoming, upstream.searchParams, 'sort');
  copySearchParam(incoming, upstream.searchParams, 'page');
  copySearchParam(incoming, upstream.searchParams, 'limit');
  if (!upstream.searchParams.has('limit')) upstream.searchParams.set('limit', '24');
  if (!upstream.searchParams.has('sort')) upstream.searchParams.set('sort', 'newest');
  if (!upstream.searchParams.has('market')) upstream.searchParams.set('market', 'FR');
  return upstream;
}

async function fetchCatalog(url: URL) {
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as ProductResponse | null;
  return { response, payload };
}

export async function GET(request: NextRequest) {
  const incoming = request.nextUrl.searchParams;
  const preferred = buildUpstream(incoming, '/api/integrations/orky/products');

  try {
    let upstream = preferred;
    let result = await fetchCatalog(upstream);

    // Deployment compatibility while the Marketplace companion PR is rolling
    // out. Once the dedicated endpoint is present it remains authoritative,
    // including approved canonical video media.
    if (result.response.status === 404) {
      upstream = buildUpstream(incoming, '/api/products');
      result = await fetchCatalog(upstream);
    }

    const { response, payload } = result;
    if (!response.ok || !payload) {
      return NextResponse.json(
        {
          success: false,
          source: 'orchidy',
          products: [],
          error: 'ORCHIDY_PRODUCTS_UNAVAILABLE',
          status: response.status,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      source: 'orchidy',
      upstream: {
        baseUrl: resolveOrchidyBaseUrl(),
        endpoint: upstream.pathname,
      },
      products: Array.isArray((payload as any).products) ? (payload as any).products : [],
      pagination: (payload as any).pagination ?? null,
      filters: (payload as any).filters ?? null,
      query: (payload as any).query ?? incoming.get('q') ?? '',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        source: 'orchidy',
        products: [],
        error: 'ORCHIDY_PRODUCTS_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Unable to fetch Orchidy products',
      },
      { status: 502 },
    );
  }
}
