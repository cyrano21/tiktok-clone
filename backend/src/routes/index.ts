import { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.routes";
import { feedRoutes } from "./feed.routes";
import { videoRoutes } from "./video.routes";
import { compositionRoutes } from "./composition.routes";
import { commerceImportRoutes } from "./commerce-import.routes";
import { externalImportRoutes } from "./external-import.routes";
import { userRoutes } from "./user.routes";
import { commentRoutes } from "./comment.routes";
import { hashtagRoutes } from "./hashtag.routes";
import { soundRoutes } from "./sound.routes";
import { searchRoutes } from "./search.routes";
import { messageRoutes } from "./message.routes";
import { liveRoutes } from "./live.routes";
import { notificationRoutes } from "./notification.routes";
import { tiktokRoutes } from "./tiktok.routes";
import { analyticsRoutes } from "./analytics.routes";
import { billingRoutes } from "./billing.routes";
import { stripeWebhookRoutes } from "./stripe-webhook.routes";
import { publishRoutes } from "./publish.routes";
import { brandingRoutes } from "./branding.routes";
import { moderationRoutes } from "./moderation.routes";
import { productMatchRoutes } from "./product-match.routes";
import { mediaRoutes } from "./media.routes";
import { telemetryRoutes } from "./telemetry.routes";

export async function registerRoutes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: "/v1/auth" });
  app.register(feedRoutes, { prefix: "/v1/feed" });
  // Register the static /compose and /import-external endpoints before the
  // generic /:id video routes so the param routes never shadow them.
  app.register(compositionRoutes, { prefix: "/v1/videos" });
  app.register(externalImportRoutes, { prefix: "/v1/videos" });
  app.register(videoRoutes, { prefix: "/v1/videos" });
  app.register(telemetryRoutes, { prefix: "/v1/telemetry" });
  app.register(commerceImportRoutes, { prefix: "/v1/commerce-imports" });
  app.register(mediaRoutes, { prefix: "/v1/media" });
  app.register(productMatchRoutes, { prefix: "/v1/product-matches" });
  app.register(userRoutes, { prefix: "/v1/users" });
  app.register(commentRoutes, { prefix: "/v1/comments" });
  app.register(hashtagRoutes, { prefix: "/v1/hashtags" });
  app.register(soundRoutes, { prefix: "/v1/sounds" });
  app.register(searchRoutes, { prefix: "/v1/search" });
  app.register(messageRoutes, { prefix: "/v1/messages" });
  app.register(liveRoutes, { prefix: "/v1/live" });
  app.register(notificationRoutes, { prefix: "/v1/notifications" });
  app.register(tiktokRoutes, { prefix: "/v1/tiktok" });
  app.register(analyticsRoutes, { prefix: "/v1/analytics" });
  app.register(stripeWebhookRoutes, { prefix: "/v1/billing" });
  app.register(billingRoutes, { prefix: "/v1/billing" });
  app.register(publishRoutes, { prefix: "/v1/publish" });
  app.register(brandingRoutes, { prefix: "/v1/branding" });
  app.register(moderationRoutes, { prefix: "/v1/moderation" });
}
