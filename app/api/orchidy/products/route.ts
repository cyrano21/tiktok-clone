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

export async function GET(request: NextRequest) {
  const incoming = request.nextUrl.searchParams;
  // /api/search returns an empty catalog on the deployed Orchidy; the canonical
  // public catalog endpoint is /api/products (same response shape: products[]).
  const upstream = new URL('/api/products', resolveOrchidyBaseUrl());

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

  try {
    const response = await fetch(upstream.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      // The shop should reflect the current Orchidy catalog, not a stale Next cache.
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null) as ProductResponse | null;
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
        endpoint: '/api/products',
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
