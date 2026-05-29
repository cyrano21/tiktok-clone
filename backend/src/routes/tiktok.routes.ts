import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth";
import { TikTokController } from "../controllers/tiktok.controller";

/**
 * Official TikTok OAuth + Content Posting API routes.
 *
 * The OAuth callback is public (TikTok redirects the browser here with a
 * one-time code; the user is matched via the signed `state` stored in Redis).
 * Everything else requires our own app authentication.
 */
export async function tiktokRoutes(app: FastifyInstance) {
  // Public: TikTok redirects the browser back here after consent.
  app.get("/callback", TikTokController.callback);

  // Protected: tied to the authenticated app user.
  app.get("/status", { preHandler: authMiddleware }, TikTokController.status);
  app.get(
    "/authorize",
    { preHandler: authMiddleware },
    TikTokController.authorize,
  );
  app.post(
    "/disconnect",
    { preHandler: authMiddleware },
    TikTokController.disconnect,
  );

  // Display API (Login Kit scopes — works with the currently-approved app).
  app.get(
    "/user-info",
    { preHandler: authMiddleware },
    TikTokController.userInfo,
  );
  app.get("/videos", { preHandler: authMiddleware }, TikTokController.videos);

  // Content Posting API (requires app approval for video.publish/video.upload).
  app.get(
    "/creator-info",
    { preHandler: authMiddleware },
    TikTokController.creatorInfo,
  );
  app.post(
    "/publish",
    { preHandler: authMiddleware },
    TikTokController.publish,
  );
  app.get(
    "/publish/:publishId/status",
    { preHandler: authMiddleware },
    TikTokController.status_publish,
  );
}
