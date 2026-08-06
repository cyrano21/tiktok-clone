import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { AnalyticsService } from '../services/analytics.service';

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Creator summary KPIs (real data)
  app.get('/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const summary = await AnalyticsService.summary(userId);
    return reply.send(summary);
  });

  // Top performing videos
  app.get('/videos', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const { limit = '5' } = req.query as any;
    const videos = await AnalyticsService.topVideos(userId, parseInt(limit));
    return reply.send({ videos });
  });

  // Daily views curve (30 days default)
  app.get('/daily', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId;
    const { days = '30' } = req.query as any;
    const buckets = await AnalyticsService.dailyViews(userId, parseInt(days));
    return reply.send({ buckets });
  });
}
