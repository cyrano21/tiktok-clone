import type { PublishedOrchidyCatalogItem } from './orchidyCatalogAuthority';

export interface CatalogMatchCandidate {
  orchidyCatalogItemId: string;
  title: string;
  slug?: string;
  images: string[];
  price?: number;
  currency?: string;
  score: number;
  source: 'catalog_lexical_match';
  requiresApproval: true;
}

interface ProductsPayload {
  products?: PublishedOrchidyCatalogItem[];
}

const STOP_WORDS = new Set([
  'avec', 'dans', 'pour', 'this', 'that', 'from', 'your', 'vous', 'the',
  'and', 'product', 'produit', 'video', 'vidéo', 'new', 'newest', 'link',
]);

export function tokenizeCatalogQuery(value: string): string[] {
  return Array.from(new Set(
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
  )).slice(0, 12);
}

export function scoreCatalogCandidate(query: string, productTitle: string): number {
  const queryTokens = tokenizeCatalogQuery(query);
  const productTokens = new Set(tokenizeCatalogQuery(productTitle));
  if (queryTokens.length === 0 || productTokens.size === 0) return 0;
  const overlap = queryTokens.filter((token) => productTokens.has(token)).length;
  return Number((overlap / queryTokens.length).toFixed(3));
}

function canonicalId(product: PublishedOrchidyCatalogItem): string {
  return String(product.publishedItemId || product.id || product.catalogProductOriginId || '').trim();
}

function imageList(product: PublishedOrchidyCatalogItem): string[] {
  const raw = (product as PublishedOrchidyCatalogItem & { images?: unknown }).images;
  return Array.isArray(raw) ? raw.filter((image): image is string => typeof image === 'string' && image.trim() !== '') : [];
}

export function rankCatalogCandidates(query: string, products: PublishedOrchidyCatalogItem[], limit = 8): CatalogMatchCandidate[] {
  return products
    .filter((product) => product.publicationStatus === 'published' && product.visible !== false && product.orderable !== false)
    .map((product) => ({
      product,
      score: scoreCatalogCandidate(query, String(product.title || '')),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(20, limit)))
    .map(({ product, score }) => ({
      orchidyCatalogItemId: canonicalId(product),
      title: String(product.title || product.name || ''),
      slug: product.slug,
      images: imageList(product),
      price: typeof product.price === 'number' ? product.price : undefined,
      currency: typeof product.currency === 'string' ? product.currency : undefined,
      score,
      source: 'catalog_lexical_match' as const,
      requiresApproval: true as const,
    }))
    .filter((candidate) => candidate.orchidyCatalogItemId && candidate.title);
}

export async function findOrchidyCatalogCandidates(
  input: { title: string; hashtags?: string[]; limit?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<CatalogMatchCandidate[]> {
  const query = [input.title, ...(input.hashtags || [])].filter(Boolean).join(' ').slice(0, 240);
  if (!query.trim()) return [];

  const url = `${(process.env.ORCHIDY_API_BASE_URL || 'https://orchidy.fr').replace(/\/$/, '')}/api/integrations/orky/products?q=${encodeURIComponent(query)}&market=FR&limit=50&sort=trending`;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    const payload = await response.json() as ProductsPayload;
    return rankCatalogCandidates(query, Array.isArray(payload.products) ? payload.products : [], input.limit);
  } catch {
    return [];
  }
}
