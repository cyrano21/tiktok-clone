import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { prisma } from '../config/database';
import { RecommendationService } from '../services/recommendation.service';

export async function feedRoutes(app: FastifyInstance) {
  // For You Page - optional auth (personalized if logged in)
  app.get('/for-you', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId || null;
    const { page = '1', limit = '20' } = req.query as any;
    const videos = await RecommendationService.getForYouFeed(userId, parseInt(page), parseInt(limit));
    return reply.send({ videos, page: parseInt(page), limit: parseInt(limit) });
  });

  // Following feed - requires auth
  app.get('/following', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const { page = '1', limit = '20' } = req.query as any;
    const videos = await RecommendationService.getFollowingFeed(userId, parseInt(page), parseInt(limit));
    return reply.send({ videos, page: parseInt(page), limit: parseInt(limit) });
  });

  // Live feed
  app.get('/live', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { page = '1', limit = '20' } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const streams = await prisma.liveStream.findMany({
      where: { isActive: true },
      orderBy: { viewerCount: 'desc' },
      skip: offset,
      take: parseInt(limit),
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true, isVerified: true } },
      },
    });
    return reply.send({ streams, page: parseInt(page), limit: parseInt(limit) });
  });

  // Trending feed
  app.get('/trending', { preHandler: optionalAuth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { page = '1', limit = '20' } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const videos = await prisma.video.findMany({
      where: { isPublished: true },
      orderBy: [{ viewsCount: 'desc' }, { likesCount: 'desc' }],
      skip: offset,
      take: parseInt(limit),
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true, isVerified: true } },
        _count: { select: { likes: true, comments: true, shares: true } },
      },
    });
    return reply.send({ videos, page: parseInt(page), limit: parseInt(limit) });
  });
}
