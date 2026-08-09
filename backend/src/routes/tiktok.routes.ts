import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authMiddleware } from "../middleware/auth";
import { prisma } from "../config/database";
import { TikTokController } from "../controllers/tiktok.controller";

async function paidContentPosting(req: FastifyRequest, reply: FastifyReply) {
  await authMiddleware(req, reply);
  if (reply.sent) return;
  const userId = (req as any).userId as string;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (user?.plan !== 'PRO' && user?.plan !== 'BUSINESS') {
    return reply.status(403).send({
      error: 'PLAN_LIMIT',
      message: 'La publication TikTok via Content Posting nécessite le plan Pro.',
      requiredPlan: 'PRO',
    });
  }
}

/** Official TikTok OAuth + Content Posting API routes. */
export async function tiktokRoutes(app: FastifyInstance) {
  app.get("/callback", TikTokController.callback);

  app.get("/status", { preHandler: authMiddleware }, TikTokController.status);
  app.get("/authorize", { preHandler: authMiddleware }, TikTokController.authorize);
  app.post("/disconnect", { preHandler: authMiddleware }, TikTokController.disconnect);

  // Login Kit / read capabilities stay available on Free.
  app.get("/user-info", { preHandler: authMiddleware }, TikTokController.userInfo);
  app.get("/videos", { preHandler: authMiddleware }, TikTokController.videos);

  // Paid feature + TikTok scope gating. Both checks must pass.
  app.get("/creator-info", { preHandler: paidContentPosting }, TikTokController.creatorInfo);
  app.post("/publish", { preHandler: paidContentPosting }, TikTokController.publish);
  // Existing publish status remains readable after a downgrade/cancellation so
  // creators can observe jobs already accepted by TikTok.
  app.get("/publish/:publishId/status", { preHandler: authMiddleware }, TikTokController.status_publish);
}
