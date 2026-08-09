import { Product, ProductCategory, ProductVariant, getProductById, getProducts } from './demoShop';

export type CommerceVariant = ProductVariant & {
  selectedOptions?: Record<string, string>;
  /** Variant-specific swatch image when the source provides one (often null). */
  image?: string | null;
  /** Live stock when the source provides it, null when unknown. */
  stock?: number | null;
};

export type CommerceProduct = Omit<Product, 'variants'> & {
  variants: CommerceVariant[];
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
// Missing configuration must never manufacture commercial products.
const USE_DEMO = process.env.NEXT_PUBLIC_USE_DEMO === 'true';

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
  return images.length > 0 ? images : ['/logo_orky.png'];
}

function normalizeSelectedOptions(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, raw]) => [String(key).trim(), String(raw).trim()] as const)
    .filter(([key, raw]) => key && raw)
    .slice(0, 20);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function variantOptions(variant: any): Record<string, string> | undefined {
  const direct = normalizeSelectedOptions(variant?.selectedOptions || variant?.options);
  if (direct) return direct;
  const attributes = Array.isArray(variant?.attributes)
    ? variant.attributes
    : Array.isArray(variant?.optionValues)
      ? variant.optionValues
      : [];
  const entries = attributes
    .map((entry: any): readonly [string, string] => [
      asText(entry?.name || entry?.key || entry?.option || entry?.label),
      asText(entry?.value || entry?.valueName || entry?.selection),
    ])
    .filter(([key, value]: readonly [string, string]) => Boolean(key && value))
    .slice(0, 20);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveVariants(product: any): CommerceVariant[] {
  const raw = Array.isArray(product?.variants) ? product.variants : [];
  // Real product images only (no placeholder): used as swatch fallback when a
  // variant ships without its own image (Orchidy variants are SKU-only).
  const productImages = (firstImage(product) || []).filter(
    (image: string) => !image.includes('logo_orky') && !image.includes('placeholder'),
  );
  const variants = raw.flatMap((variant: any, index: number) => {
    const id = asText(variant?.id || variant?._id || variant?.sku || variant?.externalId);
    if (!id) return [];
    const named = asText(variant?.title || variant?.name || variant?.label);
    const sku = asText(variant?.sku);
    // Orchidy variants expose only { sku, price, stock, image }: no color/option
    // names. Prefer an explicit label, else show a readable reference code
    // instead of a bare SKU.
    const label = named || (sku ? `Réf. ${sku}` : `Variante ${index + 1}`);
    const imageRaw = variant?.image || variant?.imageUrl || variant?.thumbnailUrl || variant?.thumb;
    // When the API gives no variant image (Orchidy returns null), fall back to
    // a real product image so every variant gets a visual swatch. Cycling by
    // index keeps variants visually distinct.
    const resolvedImage =
      imageRaw
        ? String(imageRaw)
        : productImages.length > 0
          ? productImages[index % productImages.length]
          : null;
    return [{
      id,
      label,
      selectedOptions: variantOptions(variant),
      image: resolvedImage,
      stock: asNullableNumber(variant?.stock ?? variant?.inventory ?? variant?.quantity),
    }];
  });
  return variants.length ? variants : [{ id: 'default', label: 'Standard' }];
}

function resolveStore(product: any) {
  const store = product?.store && typeof product.store === 'object' ? product.store : null;
  return {
    id: asText(store?._id || product?.storeId || product?.sellerId || 'orchidy-store'),
    name: asText(store?.name || product?.shopName || product?.storeName, 'Orchidy'),
    avatar: asText(store?.logo || product?.shopAvatar || '/logo_orky.png'),
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
  return `${base}/product/${encodeURIComponent(slug)}`;
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
    variants: resolveVariants(product),
    badges: [ORCHIDY_SOURCE.toUpperCase(), ...(orderable ? ['Achetable'] : ['Indisponible']), ...(store.verified ? ['Boutique vérifiée'] : [])],
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

function demoProducts(category: ProductCategory): CommerceProduct[] {
  return USE_DEMO ? getProducts(category).map((product) => ({ ...product, source: 'demo' as const })) : [];
}

export async function getCommerceProducts(query: ProductQuery = {}): Promise<CommerceProduct[]> {
  const params = new URLSearchParams();
  params.set('limit', String(query.limit ?? 24));
  params.set('page', String(query.page ?? 1));
  params.set('sort', query.sort ?? (query.query ? 'relevance' : 'newest'));
  if (query.query) params.set('q', query.query);
  if (query.category && query.category !== 'all') params.set('category', query.category);

  try {
    const response = await fetch(`/api/orchidy/products?${params.toString()}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Orchidy products unavailable (${response.status})`);
    const payload = await response.json() as OrchidySearchResponse;
    const products = Array.isArray(payload.products) ? payload.products.map(mapOrchidyProduct) : [];
    return products.length > 0 ? products : demoProducts(query.category ?? 'all');
  } catch {
    return demoProducts(query.category ?? 'all');
  }
}

export async function getCommerceProductById(productId: string): Promise<CommerceProduct | undefined> {
  const cached = productCache.get(productId);
  if (cached) return cached;

  if (USE_DEMO) {
    const demo = getProductById(productId);
    if (demo) return { ...demo, source: 'demo' };
  }

  if (productId.startsWith('orchidy:')) {
    const rawId = productId.slice('orchidy:'.length);
    try {
      const response = await fetch(`/api/orchidy/products/${encodeURIComponent(rawId)}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json() as { product?: unknown };
        if (payload.product) return mapOrchidyProduct(payload.product);
      }
    } catch {
      // Fall through to bounded search.
    }

    const products = await getCommerceProducts({ query: rawId, limit: 20, sort: 'relevance' });
    return products.find((product) => product.id === productId || product.externalId === rawId || product.externalSlug === rawId);
  }

  return undefined;
}

export function getCachedCommerceProduct(productId: string): CommerceProduct | undefined {
  return productCache.get(productId) || (USE_DEMO ? getProductById(productId) : undefined);
}
