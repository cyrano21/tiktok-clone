import Fastify from 'fastify';
import { commerceImportRoutes } from './commerce-import.routes';

/**
 * LOT 7 — Gate « une panne transitoire ne crée jamais deux vidéos ».
 *
 * Pro generates one video per sourcing request (stable `jobId` =
 * `externalContentId`). ORKY's backend import must therefore produce at most
 * one Video per `(user, externalContentId)` even when the import route is
 * replayed (double webhook, retry after a crashed link step) or raced by two
 * concurrent workers. The production code defends twice: a pre-check
 * `findFirst` by provenance, then the `@@unique([externalPlatform,
 * externalContentId])` constraint whose P2002 race is reconciled to the
 * winner. This suite proves both paths with a mocked prisma.
 */

const mockVideoFindFirst = jest.fn();
const mockVideoCreate = jest.fn();
const mockVideoProductMatchUpsert = jest.fn();
const mockVideoProductMatchCreate = jest.fn();
const mockUserUpdate = jest.fn();
const mockTransaction = jest.fn();
const mockValidateOrchidyCatalogItem = jest.fn();
const mockIngestMedia = jest.fn();
const mockDeleteMediaObjects = jest.fn();

jest.mock('../middleware/auth', () => ({
  authMiddleware: async (req: { userId?: string }) => {
    req.userId = 'u-lot7';
  },
}));

jest.mock('../config/database', () => ({
  prisma: {
    video: {
      findFirst: (...args: unknown[]) => mockVideoFindFirst(...args),
      create: (...args: unknown[]) => mockVideoCreate(...args),
    },
    videoProductMatch: {
      upsert: (...args: unknown[]) => mockVideoProductMatchUpsert(...args),
      create: (...args: unknown[]) => mockVideoProductMatchCreate(...args),
    },
    user: {
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('./product-match.routes', () => ({
  validateOrchidyCatalogItem: (...args: unknown[]) =>
    mockValidateOrchidyCatalogItem(...args),
}));

jest.mock('../services/video.service', () => ({
  ingestMedia: (...args: unknown[]) => mockIngestMedia(...args),
  deleteMediaObjects: (...args: unknown[]) => mockDeleteMediaObjects(...args),
}));

function videoResponse(overrides: Record<string, any> = {}) {
  return {
    id: 'vid-created',
    videoUrl: 'https://cdn.test/v.mp4',
    thumbnailUrl: 'https://cdn.test/t.jpg',
    videoKey: 'k/v.mp4',
    thumbnailKey: 'k/t.jpg',
    duration: 12,
    width: 720,
    height: 1280,
    ...overrides,
  };
}

function transactionTx() {
  return {
    video: { create: mockVideoCreate },
    videoProductMatch: { create: mockVideoProductMatchCreate },
    user: { update: mockUserUpdate },
  };
}

function buildApp() {
  const app = Fastify();
  app.register(commerceImportRoutes);
  return app;
}

function payload(overrides: Record<string, any> = {}) {
  return {
    sourceUrl: 'https://res.cloudinary.com/acme/video/upload/job-abcdef123456.mp4',
    externalContentId: 'job-abcdef123456',
    orchidyCatalogItemId: 'orchidy-item-1',
    title: 'Vidéo produit',
    description: 'Produit viral détecté',
    ...overrides,
  };
}

const headers = {
  authorization: 'Bearer anything',
  'x-orky-commerce-import-secret': 'lot7-test-secret',
  'content-type': 'application/json',
};

describe('LOT 7 — POST /v1/commerce-imports/generated-video', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.ORKY_COMMERCE_IMPORT_SECRET = 'lot7-test-secret';
    mockValidateOrchidyCatalogItem.mockResolvedValue({ ok: true });
    mockVideoFindFirst.mockResolvedValue(null);
    mockVideoCreate.mockResolvedValue({ id: 'vid-created' });
    mockVideoProductMatchCreate.mockResolvedValue({ id: 'match-created' });
    mockVideoProductMatchUpsert.mockResolvedValue({ id: 'match-upserted' });
    mockUserUpdate.mockResolvedValue({ id: 'u-lot7' });
    mockTransaction.mockImplementation(async (fn: unknown) =>
      (fn as (tx: unknown) => Promise<unknown>)(transactionTx()),
    );
    mockIngestMedia.mockResolvedValue(videoResponse());
    mockDeleteMediaObjects.mockResolvedValue(undefined);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('fake-video-bytes'));
        controller.close();
      },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? 'video/mp4' : '0',
      },
      body: stream,
    }) as unknown as typeof fetch;
  });

  it('import initial : une vidéo créée, 201', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/generated-video',
      payload: payload(),
      headers,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      success: true,
      idempotent: false,
      videoId: 'vid-created',
    });
    expect(mockVideoFindFirst).toHaveBeenCalledTimes(1);
    expect(mockVideoCreate).toHaveBeenCalledTimes(1);
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    expect(mockVideoProductMatchCreate).toHaveBeenCalledTimes(1);
  });

  it('double import (retry après panne du lien Pro) : idempotent, aucune seconde vidéo', async () => {
    const app = buildApp();
    mockVideoFindFirst
      .mockResolvedValueOnce(null) // premier import : rien d'existant
      .mockResolvedValue({ id: 'vid-created' }); // replay : l'import a réussi entre-temps

    const first = await app.inject({
      method: 'POST',
      url: '/generated-video',
      payload: payload(),
      headers,
    });
    const replay = await app.inject({
      method: 'POST',
      url: '/generated-video',
      payload: payload(),
      headers,
    });

    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({
      success: true,
      idempotent: true,
      videoId: 'vid-created',
    });
    // Une seule création vidéo au total, jamais deux.
    expect(mockVideoCreate).toHaveBeenCalledTimes(1);
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    // Le replay raccorde le product-match existant, sans nouvelle vidéo.
    expect(mockVideoProductMatchUpsert).toHaveBeenCalledTimes(1);
    // Un seul téléversement média : le premier import l'a ingéré, le replay non.
    expect(mockIngestMedia).toHaveBeenCalledTimes(1);
  });

  it('redémarrage / course de deux workers : la contrainte unique P2002 est réconciliée vers le gagnant', async () => {
    const app = buildApp();
    // Les deux workers voient « rien d'existant » ; le second perd la course
    // sur la contrainte @@unique([externalPlatform, externalContentId]) au
    // moment du commit : le callback a tourné (créations tentées) mais la
    // transaction est annulée (P2002).
    mockVideoFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'vid-winner' });
    mockTransaction.mockImplementation(async (fn: unknown) => {
      await (fn as (tx: unknown) => Promise<unknown>)(transactionTx());
      throw Object.assign(new Error('duplicate'), { code: 'P2002' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/generated-video',
      payload: payload(),
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      idempotent: true,
      videoId: 'vid-winner',
    });
    // Le perdant nettoie le média déjà téléversé…
    expect(mockDeleteMediaObjects).toHaveBeenCalledTimes(1);
    // …et la création perdue est réconciliée : le gagnant est renvoyé, pas une
    // seconde vidéo. Sur vraie base, le rollback annule le user.update tenté.
    expect(mockVideoCreate).toHaveBeenCalledTimes(1);
    expect(mockVideoFindFirst).toHaveBeenCalledTimes(2);
  });

  it('produit Orchidy indisponible : 422, aucun appel d’import', async () => {
    mockValidateOrchidyCatalogItem.mockResolvedValue({
      ok: false,
      reason: 'CATALOG_ITEM_NOT_PUBLISHED',
    });
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/generated-video',
      payload: payload(),
      headers,
    });

    expect(response.statusCode).toBe(422);
    expect(mockVideoFindFirst).not.toHaveBeenCalled();
    expect(mockVideoCreate).not.toHaveBeenCalled();
  });

  it('secret interne manquant : 403, zéro effet de bord', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/generated-video',
      payload: payload(),
      headers: { authorization: 'Bearer anything', 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(403);
    expect(mockVideoFindFirst).not.toHaveBeenCalled();
    expect(mockVideoCreate).not.toHaveBeenCalled();
  });
});
