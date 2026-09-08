export interface PublishedOrchidyCatalogItem {
  id: string;
  publishedItemId?: string;
  catalogProductOriginId?: string;
  publicationStatus?: string;
  visible?: boolean;
  orderable?: boolean;
  title?: string;
  name?: string;
  slug?: string;
  images?: unknown;
  price?: number;
  currency?: string;
}

interface AuthorityPayload {
  product?: PublishedOrchidyCatalogItem;
  [key: string]: unknown;
}

export interface CatalogAuthorityResult {
  ok: boolean;
  canonicalId?: string;
  product?: PublishedOrchidyCatalogItem;
  reason?: 'not_found' | 'unpublished' | 'invalid_response' | 'unavailable';
}

function baseUrl(): string {
  return (process.env.ORCHIDY_API_BASE_URL || 'https://orchidy.fr').replace(/\/$/, '');
}

function canonicalId(product: PublishedOrchidyCatalogItem): string {
  return String(product.publishedItemId || product.id || product.catalogProductOriginId || '').trim();
}

export function isPublishedOrchidyProjection(product: PublishedOrchidyCatalogItem | null | undefined): boolean {
  if (!product || !canonicalId(product)) return false;
  if (product.publicationStatus !== 'published') return false;
  if (product.visible === false || product.orderable === false) return false;
  return true;
}

export async function resolvePublishedOrchidyCatalogItem(
  requestedId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CatalogAuthorityResult> {
  const id = String(requestedId || '').trim();
  if (!id) return { ok: false, reason: 'not_found' };

  const url = `${baseUrl()}/api/integrations/orky/products/${encodeURIComponent(id)}?market=FR`;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 404) return { ok: false, reason: 'not_found' };
    if (!response.ok) return { ok: false, reason: 'unavailable' };

    const payload = await response.json() as AuthorityPayload;
    const product = payload?.product;
    if (!product || !isPublishedOrchidyProjection(product)) {
      return { ok: false, reason: product ? 'unpublished' : 'invalid_response' };
    }

    return { ok: true, canonicalId: canonicalId(product), product };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
