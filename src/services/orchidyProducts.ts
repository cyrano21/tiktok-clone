import { Product, ProductCategory, getProductById, getProducts } from './demoShop';

export type CommerceProduct = Product & {
  source?: 'demo' | 'orchidy';
  externalId?: string;
  externalSlug?: string;
  externalUrl?: string;
  orderable?: boolean;
  availabilityLabel?: string;
  stockStatus?: string;
};

interface OrchidySearchResponse {
  success?: boolean;
  products?: any[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
    hasMore?: boolean;
  } | null;
}

export interface ProductQuery {
  category?: ProductCategory;
  query?: string;
  page?: number;
  limit?: number;
  sort?: 'newest' | 'relevance' | 'bestseller' | 'rating' | 'price_asc' | 'price_desc';
}

const productCache = new Map<string, CommerceProduct>();
const ORCHIDY_SOURCE = 'orchidy' as const;

function asNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function firstImage(product: any): string[] {
  const images = Array.isArray(product?.images)
    ? product.images.map(String).map((image: string) => image.trim()).filter(Boolean)
    : [];
  const image = asText(product?.image || product?.thumbnailUrl || product?.coverUrl);
  if (image && !images.includes(image)) images.unshift(image);
  return images.length > 0 ? images : ['https://picsum.photos/seed/orchidy-product/600/800'];
}

function resolveStore(product: any) {
  const store = product?.store && typeof product.store === 'object' ? product.store : null;
  return {
    id: asText(store?._id || product?.storeId || product?.sellerId || 'orchidy-store'),
    name: asText(store?.name || product?.shopName || product?.storeName, 'Orchidy'),
    avatar: asText(store?.logo || product?.shopAvatar || 'https://orchidy.fr/logo_orky.png'),
    slug: asText(store?.slug || ''),
    verified: store?.isVerified === true || store?.templateActive === true,
  };
}

function resolveCategory(product: any): ProductCategory {
  const raw = asText(product?.category?.slug || product?.categorySlug || product?.category?.name || product?.category).toLowerCase();
  if (raw.includes('beaut')) return 'beauty';
  if (raw.includes('mode') || raw.includes('fashion') || raw.includes('cloth')) return 'fashion';
  if (raw.includes('tech') || raw.includes('elect') || raw.includes('phone') || raw.includes('audio')) return 'tech';
  if (raw.includes('home') || raw.includes('maison') || raw.includes('deco')) return 'home';
  if (raw.includes('sport') || raw.includes('fitness')) return 'fitness';
  if (raw.includes('access')) return 'accessories';
  return 'all';
}

function buildExternalUrl(product: any): string {
  const base = (process.env.NEXT_PUBLIC_ORCHIDY_BASE_URL || 'https://orchidy.fr').replace(/\/$/, '');
  const slug = asText(product?.slug || product?.seo?.slug || product?._id || product?.id);
  if (!slug) return base;
  return `${base}/products/${encodeURIComponent(slug)}`;
}

export function mapOrchidyProduct(product: any): CommerceProduct {
  const externalId = asText(product?.id || product?._id || product?.slug || crypto.randomUUID());
  const externalSlug = asText(product?.slug || product?.seo?.slug || externalId);
  const store = resolveStore(product);
  const price = asNumber(product?.price || product?.salePrice || product?.sellingPrice || product?.priceClient, 0);
  const compareAt = asNumber(product?.originalPrice || product?.compareAtPrice, price || 0);
  const originalPrice = compareAt > price ? compareAt : price;
  const currencyRaw = asText(product?.currency, 'EUR').toUpperCase();
  const currency = currencyRaw === 'EUR' ? '€' : currencyRaw;
  const orderable = product?.orderable !== false && product?.stockStatus !== 'out_of_stock';

  const mapped: CommerceProduct = {
    id: `orchidy:${externalSlug}`,
    title: asText(product?.title || product?.name, 'Produit Orchidy'),
    description: asText(product?.description, 'Produit disponible sur Orchidy.'),
    price,
    originalPrice,
    currency,
    images: firstImage(product),
    rating: asNumber(product?.rating, 0),
    reviewsCount: asNumber(product?.reviewCount || product?.reviewsCount, 0),
    soldCount: asNumber(product?.soldCount, 0),
    sellerId: `orchidy:${store.id}`,
    shopName: store.name,
    shopAvatar: store.avatar,
    category: resolveCategory(product),
    freeShipping: Boolean(product?.freeShipping || product?.readyToShip || product?.delivery === 'fast'),
    variants: [{ id: 'default', label: 'Standard' }],
    badges: [
      ORCHIDY_SOURCE.toUpperCase(),
      ...(orderable ? ['Achetable'] : ['Indisponible']),
      ...(store.verified ? ['Boutique vérifiée'] : []),
    ],
    onSale: originalPrice > price,
    source: ORCHIDY_SOURCE,
    externalId,
    externalSlug,
    externalUrl: buildExternalUrl(product),
    orderable,
    availabilityLabel: asText(product?.availabilityLabel),
    stockStatus: asText(product?.stockStatus),
  };

  productCache.set(mapped.id, mapped);
  productCache.set(externalId, mapped);
  productCache.set(externalSlug, mapped);
  return mapped;
}

export async function getCommerceProducts(query: ProductQuery = {}): Promise<CommerceProduct[]> {
  const params = new URLSearchParams();
  params.set('limit', String(query.limit ?? 24));
  params.set('page', String(query.page ?? 1));
  params.set('sort', query.sort ?? (query.query ? 'relevance' : 'newest'));
  if (query.query) params.set('q', query.query);
  if (query.category && query.category !== 'all') params.set('category', query.category);

  try {
    const response = await fetch(`/api/orchidy/products?${params.toString()}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Orchidy products unavailable (${response.status})`);
    const payload = await response.json() as OrchidySearchResponse;
    const products = Array.isArray(payload.products) ? payload.products.map(mapOrchidyProduct) : [];
    return products.length > 0 ? products : getProducts(query.category ?? 'all').map((product) => ({ ...product, source: 'demo' }));
  } catch {
    return getProducts(query.category ?? 'all').map((product) => ({ ...product, source: 'demo' }));
  }
}

export async function getCommerceProductById(productId: string): Promise<CommerceProduct | undefined> {
  const cached = productCache.get(productId);
  if (cached) return cached;

  const demo = getProductById(productId);
  if (demo) return { ...demo, source: 'demo' };

  if (productId.startsWith('orchidy:')) {
    const rawId = productId.slice('orchidy:'.length);
    const products = await getCommerceProducts({ query: rawId, limit: 20, sort: 'relevance' });
    return products.find((product) =>
      product.id === productId ||
      product.externalId === rawId ||
      product.externalSlug === rawId,
    );
  }

  return undefined;
}

export function getCachedCommerceProduct(productId: string): CommerceProduct | undefined {
  return productCache.get(productId) || getProductById(productId);
}
