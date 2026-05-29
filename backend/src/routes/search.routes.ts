import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';

export async function searchRoutes(app: FastifyInstance) {
  // Search all (videos, users, hashtags, sounds)
  app.get('/all', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q, page = '1', limit = '10' } = req.query as any;
    if (!q) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Query parameter q is required' });
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [videos, users, hashtags, sounds] = await Promise.all([
      prisma.video.findMany({
        where: { caption: { contains: q, mode: 'insensitive' }, isPublished: true },
        take: parseInt(limit),
        skip: offset,
        include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
      }),
      prisma.user.findMany({
        where: { OR: [{ username: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] },
        take: parseInt(limit),
        skip: offset,
        select: { id: true, username: true, displayName: true, avatar: true, isVerified: true, _count: { select: { followers: true } } },
      }),
      prisma.hashtag.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        take: parseInt(limit),
        skip: offset,
        include: { _count: { select: { videos: true } } },
      }),
      prisma.sound.findMany({
        where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { artist: { contains: q, mode: 'insensitive' } }] },
        take: parseInt(limit),
        skip: offset,
        include: { _count: { select: { videos: true } } },
      }),
    ]);

    return reply.send({ videos, users, hashtags, sounds });
  });

  // Search videos
  app.get('/videos', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q, page = '1', limit = '20' } = req.query as any;
    if (!q) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Query parameter q is required' });
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const videos = await prisma.video.findMany({
      where: { caption: { contains: q, mode: 'insensitive' }, isPublished: true },
      orderBy: { viewsCount: 'desc' },
      skip: offset,
      take: parseInt(limit),
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true, isVerified: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    return reply.send({ videos, page: parseInt(page), limit: parseInt(limit) });
  });

  // Search users
  app.get('/users', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q, page = '1', limit = '20' } = req.query as any;
    if (!q) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Query parameter q is required' });
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const users = await prisma.user.findMany({
      where: { OR: [{ username: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] },
      skip: offset,
      take: parseInt(limit),
      select: { id: true, username: true, displayName: true, avatar: true, bio: true, isVerified: true, _count: { select: { followers: true, videos: true } } },
    });
    return reply.send({ users, page: parseInt(page), limit: parseInt(limit) });
  });

  // Search hashtags
  app.get('/hashtags', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q, page = '1', limit = '20' } = req.query as any;
    if (!q) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Query parameter q is required' });
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const hashtags = await prisma.hashtag.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { videos: { _count: 'desc' } },
      skip: offset,
      take: parseInt(limit),
      include: { _count: { select: { videos: true } } },
    });
    return reply.send({ hashtags, page: parseInt(page), limit: parseInt(limit) });
  });

  // Search sounds
  app.get('/sounds', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q, page = '1', limit = '20' } = req.query as any;
    if (!q) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Query parameter q is required' });
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const sounds = await prisma.sound.findMany({
      where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { artist: { contains: q, mode: 'insensitive' } }] },
      skip: offset,
      take: parseInt(limit),
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } }, _count: { select: { videos: true } } },
    });
    return reply.send({ sounds, page: parseInt(page), limit: parseInt(limit) });
  });
}
