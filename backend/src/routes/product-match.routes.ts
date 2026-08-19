import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';

const createSchema = z.object({
  videoId: z.string().uuid(),
  orchidyCatalogItemId: z.string().trim().min(1).max(300),
  variantKey: z.string().trim().max(300).optional().default(''),
  confidence: z.number().min(0).max(1).optional().default(1),
  source: z.enum(['manual', 'matcher', 'import']).optional().default('manual'),
}).strict();

function activeUserWhere(): Prisma.UserWhereInput {
  return {
    isBanned: false,
    OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: new Date() } }],
  };
}

const ORCHIDY_BASE_URL =
  process.env.ORCHIDY_API_BASE_URL ||
  process.env.NEXT_PUBLIC_ORCHIDY_BASE_URL ||
  'https://orchidy.fr';

interface OrchidyProduct {
  orderable?: boolean;
  stockStatus?: string;
  isActive?: boolean;
  isPublished?: boolean;
  status?: string;
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Upstream timeout')), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

function titleScore(queryTokens: Set<string>, candidateTokens: string[]): number {
  if (queryTokens.size === 0 || candidateTokens.length === 0) return 0;
  const hits = candidateTokens.filter((token) => queryTokens.has(token)).length;
  const precision = hits / candidateTokens.length;
  const recall = hits / queryTokens.size;
  return 0.5 * precision + 0.5 * recall;
}

function categoryBonus(queryTokens: Set<string>, category: string): number {
  if (!category) return 0;
  const catTokens = new Set(tokenize(category));
  for (const t of catTokens) { if (queryTokens.has(t)) return 0.3; }
  return 0;
}

function descriptionBoost(queryTokens: Set<string>, description: string): number {
  if (!description) return 0;
  const descTokens = tokenize(description).filter((t) => t.length > 4);
  const rareQuery = [...queryTokens].filter((t) => t.length > 4);
  if (descTokens.length === 0 || rareQuery.length === 0) return 0;
  const descSet = new Set(descTokens);
  const hits = rareQuery.filter((t) => descSet.has(t)).length;
  return Math.min(0.15, hits * 0.05);
}

/** Score lexical composite ∈ [0,1] : titre + catégorie + description. */
export function lexicalScore(query: string, product: { title?: string; category?: string; description?: string }): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;
  const s = titleScore(queryTokens, tokenize(product.title || ''))
    + categoryBonus(queryTokens, product.category || '')
    + descriptionBoost(queryTokens, product.description || '');
  return Math.min(1, s);
}

export async function validateOrchidyCatalogItem(itemId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const url = `${ORCHIDY_BASE_URL.replace(/\/$/, '')}/api/products/${encodeURIComponent(itemId)}`;
  let response: Response;
  try {
    response = await withTimeout(fetch(url, {
      headers: { accept: 'application/json' },
    }), 8_000);
  } catch {
    return { ok: false, reason: 'ORCHIDY_CATALOG_UNAVAILABLE' };
  }
  if (!response.ok) return { ok: false, reason: 'ORCHIDY_PRODUCT_NOT_FOUND' };
  const payload = (await response.json().catch(() => null)) as { product?: OrchidyProduct } | OrchidyProduct | null;
  const product = (payload as any)?.product ?? payload ?? null;
  if (!product || typeof product !== 'object') return { ok: false, reason: 'ORCHIDY_PRODUCT_NOT_FOUND' };
  const p = product as OrchidyProduct;
  const explicitStatus = p.status ?? 'published';
  const publishedFlag = p.isPublished ?? p.isActive ?? explicitStatus !== 'draft';
  const isPublished =
    publishedFlag !== false &&
    explicitStatus !== 'draft' &&
    explicitStatus !== 'archived' &&
    explicitStatus !== 'disabled';
  const isOrderable = p.orderable !== false && p.stockStatus !== 'out_of_stock';
  if (!isPublished) return { ok: false, reason: 'ORCHIDY_PRODUCT_NOT_PUBLISHED' };
  if (!isOrderable) return { ok: false, reason: 'ORCHIDY_PRODUCT_NOT_ORDERABLE' };
  return { ok: true };
}

export async function productMatchRoutes(app: FastifyInstance) {
  app.get('/candidates', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      title: z.string().trim().min(2).max(500),
      hashtags: z.string().trim().max(500).optional().default(''),
      limit: z.coerce.number().int().min(1).max(20).optional().default(8),
    }).parse(req.query);

    const upstream = new URL('/api/integrations/orky/products', ORCHIDY_BASE_URL);
    upstream.searchParams.set('q', query.title);
    upstream.searchParams.set('market', 'FR');
    upstream.searchParams.set('sort', 'relevance');
    // Demander un surplus en amont : le scoring lexical filtre ensuite.
    upstream.searchParams.set('limit', String(Math.min(40, query.limit * 3)));

    let payload: any = null;
    try {
      const response = await withTimeout(fetch(upstream.toString(), {
        headers: { accept: 'application/json' },
      }), 8_000);
      if (response.ok) payload = await response.json().catch(() => null);
    } catch {
      payload = null;
    }

    const products = Array.isArray(payload?.products) ? payload.products : [];
    const searchText = `${query.title} ${query.hashtags.replace(/,/g, ' ')}`;
    const candidates = products
      .map((product: any) => {
        const itemId = String(product?.slug || product?.seo?.slug || product?.id || product?._id || '').trim();
        const candidateTitle = String(product?.title || product?.name || '').trim();
        if (!itemId || !candidateTitle) return null;
        const images = Array.isArray(product?.images)
          ? product.images.map(String).filter((image: string) => /^https?:\/\//i.test(image))
          : [];
        const image = String(product?.image || product?.thumbnailUrl || product?.coverUrl || '').trim();
        if (/^https?:\/\//i.test(image) && !images.includes(image)) images.unshift(image);
        const price = Number(product?.price ?? product?.priceClient ?? product?.salePrice);
        const currency = String(product?.currency || 'EUR').trim().toUpperCase();
        const category = String(product?.categoryName || '').trim();
        const description = String(product?.description || '').trim().slice(0, 500);
        const score = lexicalScore(searchText, { title: candidateTitle, category, description });
        return {
          orchidyCatalogItemId: itemId,
          title: candidateTitle,
          slug: String(product?.slug || product?.seo?.slug || '').trim() || undefined,
          images,
          price: Number.isFinite(price) && price > 0 ? price : undefined,
          currency: currency || undefined,
          score: Number(score.toFixed(3)),
          source: 'catalog_lexical_match' as const,
          requiresApproval: true as const,
        };
      })
      .filter((candidate: any) => candidate !== null && candidate.score >= 0.2)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, query.limit);

    return reply.send({ candidates });
  });

  app.get('/video/:videoId', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { videoId } = z.object({ videoId: z.string().uuid() }).parse(req.params);
    const viewerId = (req as any).userId as string | undefined;
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        OR: [{ visibility: 'public' }, ...(viewerId ? [{ userId: viewerId }] : [])],
        user: activeUserWhere(),
      },
      select: { id: true },
    });
    if (!video) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });

    const matches = await prisma.videoProductMatch.findMany({
      where: { videoId, status: 'active' },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'asc' }],
      take: 5,
    });
    return reply.send({ matches });
  });

  app.post('/', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const body = createSchema.parse(req.body);
    const video = await prisma.video.findUnique({
      where: { id: body.videoId },
      select: { id: true, userId: true },
    });
    if (!video) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Video not found' });
    if (video.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only the video owner may attach products' });
    }

    const validation = await validateOrchidyCatalogItem(body.orchidyCatalogItemId);
    if (!validation.ok) {
      return reply.status(422).send({ error: validation.reason, message: 'Le produit Orchidy est introuvable, non publié ou non achetable.' });
    }

    const match = await prisma.videoProductMatch.upsert({
      where: {
        videoId_orchidyCatalogItemId_variantKey: {
          videoId: body.videoId,
          orchidyCatalogItemId: body.orchidyCatalogItemId,
          variantKey: body.variantKey,
        },
      },
      create: {
        videoId: body.videoId,
        orchidyCatalogItemId: body.orchidyCatalogItemId,
        variantKey: body.variantKey,
        confidence: body.confidence,
        source: body.source,
        status: 'active',
      },
      update: {
        confidence: body.confidence,
        source: body.source,
        status: 'active',
      },
    });
    return reply.status(201).send({ match });
  });

  app.delete('/:id', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const match = await prisma.videoProductMatch.findUnique({
      where: { id },
      include: { video: { select: { userId: true } } },
    });
    if (!match) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Product match not found' });
    if (match.video.userId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only the video owner may remove products' });
    }
    await prisma.videoProductMatch.delete({ where: { id } });
    return reply.send({ deleted: true });
  });
}
