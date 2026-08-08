import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/database';
import { AnalyticsService } from '../services/analytics.service';

async function requireAdvancedAnalytics(userId: string, reply: FastifyReply) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (user?.plan !== 'PRO' && user?.plan !== 'BUSINESS') {
    reply.status(403).send({
      error: 'PLAN_LIMIT',
      message: 'Les analytics avancées nécessitent le plan Pro.',
      requiredPlan: 'PRO',
    });
    return false;
  }
  return true;
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Basic summary remains available to every authenticated creator.
  app.get('/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    const summary = await AnalyticsService.summary(userId);
    return reply.send(summary);
  });

  app.get('/videos', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    if (!(await requireAdvancedAnalytics(userId, reply))) return;
    const { limit } = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(5),
    }).parse(req.query);
    const videos = await AnalyticsService.topVideos(userId, limit);
    return reply.send({ videos });
  });

  app.get('/daily', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId as string;
    if (!(await requireAdvancedAnalytics(userId, reply))) return;
    const { days } = z.object({
      days: z.coerce.number().int().min(1).max(90).default(30),
    }).parse(req.query);
    const buckets = await AnalyticsService.dailyViews(userId, days);
    return reply.send({ buckets });
  });
}
