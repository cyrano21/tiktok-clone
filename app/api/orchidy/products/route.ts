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

function text(value: unknown, max = 2_000) {
  return String(value ?? '').trim().slice(0, max);
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function httpsUrl(value: unknown): string | null {
  const raw = text(value, 4_000);
  if (!/^https:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeOptions(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, raw]) => [text(key, 80), text(raw, 160)] as const)
    .filter(([key, raw]) => key && raw)
    .slice(0, 20);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function publicVariant(value: unknown) {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  // externalId may be the upstream supplier/provider id. Only canonical public
  // variant identifiers can cross the ORKY browser boundary.
  const id = text(source.id || source._id || source.sku, 300);
  if (!id) return null;
  const stockValue = source.stock ?? source.quantity;
  const stock = Number(stockValue);
  return {
    id,
    title: text(source.title || source.name || source.label, 300) || null,
    price: number(source.price ?? source.sellingPrice ?? source.priceClient),
    currency: text(source.currency, 3).toUpperCase() || null,
    stock: Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : null,
    stockKnown: source.stockKnown === true,
    image: httpsUrl(source.image || source.imageUrl),
    selectedOptions: safeOptions(source.selectedOptions || source.options),
  };
}

/**
 * Defense in depth: the Marketplace endpoint is already DTO-based, but ORKY
 * still filters every product so a rollout fallback to /api/products can never
 * expose supplier costs, owner ids, provider credentials, reliability details
 * or internal publication metadata to the browser.
 */
function publicProduct(value: unknown) {
  const source = value && typeof value === 'object' ? (value as Record<string, any>) : {};
  const id = text(source.id || source._id || source.catalogProductOriginId || source.slug, 300);
  if (!id) return null;
  const images = Array.from(
    new Set(
      (Array.isArray(source.images) ? source.images : [source.image])
        .map(httpsUrl)
        .filter((entry): entry is string => Boolean(entry)),
    ),
  ).slice(0, 12);
  const videos = Array.from(
    new Set(
      [
        ...(Array.isArray(source.videos) ? source.videos : []),
        source.videoUrl,
      ]
        .map((entry: any) =>
          typeof entry === 'string'
            ? httpsUrl(entry)
            : httpsUrl(entry?.hostedUrl || entry?.sourceUrl || entry?.url),
        )
        .filter((entry): entry is string => Boolean(entry)),
    ),
  ).slice(0, 6);
  const variants = (Array.isArray(source.variants) ? source.variants : [])
    .map(publicVariant)
    .filter(Boolean)
    .slice(0, 100);
  const storeSource =
    source.store && typeof source.store === 'object' ? source.store : null;
  const categorySource =
    source.category && typeof source.category === 'object' ? source.category : null;

  return {
    _id: id,
    id,
    slug: text(source.slug || id, 300),
    title: text(source.title || source.name, 500),
    name: text(source.name || source.title, 500),
    description: text(source.description, 8_000),
    images,
    image: images[0] || null,
    price: number(source.price ?? source.priceClient ?? source.sellingPrice),
    priceClient: number(source.priceClient ?? source.price ?? source.sellingPrice),
    compareAtPrice:
      source.compareAtPrice == null && source.originalPrice == null
        ? null
        : number(source.compareAtPrice ?? source.originalPrice),
    currency: text(source.currency, 3).toUpperCase() || 'EUR',
    category: categorySource
      ? {
          slug: text(categorySource.slug || source.categorySlug, 160) || null,
          name: text(categorySource.name, 240) || null,
        }
      : {
          slug: text(source.categorySlug || source.category, 160) || null,
          name: null,
        },
    categorySlug: text(source.categorySlug || categorySource?.slug, 160) || null,
    variants,
    stock:
      Number.isFinite(Number(source.stock)) && Number(source.stock) >= 0
        ? Math.floor(Number(source.stock))
        : null,
    stockKnown: source.stockKnown === true,
    inStock: source.inStock === true || source.stockStatus === 'in_stock',
    orderable: source.orderable !== false,
    availability: text(source.availability, 80),
    stockStatus: text(source.stockStatus, 80),
    videos,
    videoUrl: videos[0] || null,
    videoAvailable: videos.length > 0,
    videoPoster: httpsUrl(source.videoPoster),
    soldCount: Math.max(0, Math.floor(number(source.soldCount))),
    rating: Math.max(0, Math.min(5, number(source.rating))),
    reviewCount: Math.max(0, Math.floor(number(source.reviewCount || source.reviewsCount))),
    featured: source.featured === true,
    store: storeSource
      ? {
          _id: text(storeSource._id || storeSource.id, 300),
          name: text(storeSource.name, 300) || 'Orchidy',
          slug: text(storeSource.slug, 300),
          logo: httpsUrl(storeSource.logo),
          isVerified: storeSource.isVerified === true,
        }
      : null,
  };
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
  const payload = (await response.json().catch(() => null)) as ProductResponse | null;
  return { response, payload };
}

export async function GET(request: NextRequest) {
  const incoming = request.nextUrl.searchParams;
  const preferred = buildUpstream(incoming, '/api/integrations/orky/products');

  try {
    let upstream = preferred;
    let result = await fetchCatalog(upstream);

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

    const products = (Array.isArray((payload as any).products)
      ? (payload as any).products
      : []
    )
      .map(publicProduct)
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      source: 'orchidy',
      upstream: {
        baseUrl: resolveOrchidyBaseUrl(),
        endpoint: upstream.pathname,
      },
      products,
      pagination: (payload as any).pagination ?? null,
      query: incoming.get('q') ?? '',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        source: 'orchidy',
        products: [],
        error: 'ORCHIDY_PRODUCTS_UNAVAILABLE',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to fetch Orchidy products',
      },
      { status: 502 },
    );
  }
}
