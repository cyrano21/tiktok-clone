const MIN_PUBLIC_PRODUCT_IMAGES = 3;

function cleanUrl(value: unknown): string {
  const url = String(value || '').trim();
  if (!/^https:\/\//i.test(url)) return '';
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function getPublicProductImages(product: any): string[] {
  const candidates = [
    ...(Array.isArray(product?.images) ? product.images : []),
    product?.image,
    product?.thumbnailUrl,
    product?.coverUrl,
  ];
  return Array.from(new Set(candidates.map(cleanUrl).filter(Boolean)));
}

export function isOrchidyBridgeProductUsable(product: any, market = 'FR'): boolean {
  if (!product || typeof product !== 'object') return false;

  const title = String(product.title || product.name || '').trim();
  if (!title) return false;

  const price = Number(product.price ?? product.priceClient ?? product.salePrice);
  if (!Number.isFinite(price) || price <= 0) return false;

  const currency = String(product.currency || '').trim().toUpperCase();
  if (market.toUpperCase() === 'FR' && currency !== 'EUR') return false;

  if (product.orderable === false || product.publicationStatus === 'draft') return false;

  return getPublicProductImages(product).length >= MIN_PUBLIC_PRODUCT_IMAGES;
}

export { MIN_PUBLIC_PRODUCT_IMAGES };
