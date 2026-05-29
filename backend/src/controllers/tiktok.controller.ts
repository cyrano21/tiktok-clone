/**
 * TikTok controller — HTTP boundary only.
 *
 * Responsibilities kept here on purpose:
 *  - authenticate / read the authed userId
 *  - parse & validate input (zod)
 *  - call the service / repository layer
 *  - map results & domain errors to HTTP responses
 *
 * No TikTok API calls and no DB queries live here directly.
 *
 * Capability gating: the currently-approved app only has Login Kit scopes
 * (user.info.basic, video.list). Endpoints that need publishing scopes return a
 * clear 403 (TIKTOK_SCOPE_MISSING) when the connected account did not grant
 * them, instead of forwarding an opaque TikTok scope error.
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";
import { z } from "zod";
import { redis } from "../config/redis";
import {
  getTikTokConfig,
  isTikTokConfigured,
  capabilitiesFromScopes,
  type TikTokCapabilities,
} from "../config/tiktok";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchUserInfo,
  listUserVideos,
  queryCreatorInfo,
  initDirectPost,
  initInboxUpload,
  fetchPublishStatus,
  TikTokApiError,
  type PrivacyLevel,
} from "../services/tiktok.service";
import {
  upsertFromTokenResponse,
  getAccount,
  getSummary,
  disconnect,
  getValidAccessToken,
  TikTokNotConnectedError,
  TikTokRefreshExpiredError,
} from "../services/tiktokAccount.repository";

const STATE_TTL_SECONDS = 600; // 10 min to complete the OAuth round-trip
const stateKey = (state: string) => `tiktok:oauth:state:${state}`;

const PrivacyEnum = z.enum([
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
]);

const PublishBodySchema = z.object({
  videoUrl: z.string().url(),
  title: z.string().min(1).max(2200),
  privacyLevel: PrivacyEnum.default("SELF_ONLY"),
  disableComment: z.boolean().optional(),
  disableDuet: z.boolean().optional(),
  disableStitch: z.boolean().optional(),
  /** When true, send to drafts (inbox) instead of a Direct Post. */
  draftOnly: z.boolean().optional(),
});

const VideoListQuerySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  maxCount: z.coerce.number().int().min(1).max(20).optional(),
});

function notConfigured(reply: FastifyReply) {
  return reply.status(503).send({
    error: "TIKTOK_NOT_CONFIGURED",
    message:
      "TikTok integration is not configured. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REDIRECT_URI from an approved TikTok developer app.",
  });
}

function scopeMissing(reply: FastifyReply, scope: string) {
  return reply.status(403).send({
    error: "TIKTOK_SCOPE_MISSING",
    message: `Your connected TikTok account did not grant the "${scope}" scope. This requires an app approved for the Content Posting API. Reconnect after the scope is added.`,
    requiredScope: scope,
  });
}

function mapTikTokError(reply: FastifyReply, err: unknown) {
  if (err instanceof TikTokNotConnectedError) {
    return reply
      .status(409)
      .send({ error: "TIKTOK_NOT_CONNECTED", message: err.message });
  }
  if (err instanceof TikTokRefreshExpiredError) {
    return reply
      .status(401)
      .send({ error: "TIKTOK_RECONNECT_REQUIRED", message: err.message });
  }
  if (err instanceof TikTokApiError) {
    return reply
      .status(err.statusCode)
      .send({
        error: "TIKTOK_API_ERROR",
        message: err.message,
        logId: err.logId,
      });
  }
  throw err; // unexpected → global error handler
}

/** Load the connected account and its granted-scope capabilities, or null. */
async function loadCapabilities(
  userId: string,
): Promise<{ scope: string; capabilities: TikTokCapabilities } | null> {
  const acc = await getAccount(userId);
  if (!acc) return null;
  return { scope: acc.scope, capabilities: capabilitiesFromScopes(acc.scope) };
}

export class TikTokController {
  /** Connection status + capabilities (used by the frontend to pick actions). */
  static async status(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req as any).userId as string;
    const summary = await getSummary(userId);
    const cfg = getTikTokConfig();

    // When connected, capabilities reflect what the user actually granted.
    // When not connected, they reflect what THIS app will request at consent.
    const capabilities = capabilitiesFromScopes(summary?.scope ?? cfg.scopes);

    return reply.send({
      configured: isTikTokConfigured(),
      connected: Boolean(summary),
      account: summary,
      requestedScopes: cfg.scopes,
      capabilities,
    });
  }

  /** Step 1: redirect the browser to TikTok's consent screen. */
  static async authorize(req: FastifyRequest, reply: FastifyReply) {
    if (!isTikTokConfigured()) return notConfigured(reply);
    const userId = (req as any).userId as string;

    const state = randomUUID();
    await redis.set(stateKey(state), userId, { EX: STATE_TTL_SECONDS });

    return reply.send({ authorizeUrl: buildAuthorizeUrl(state) });
  }

  /** Step 2: TikTok redirects here with ?code & ?state. */
  static async callback(req: FastifyRequest, reply: FastifyReply) {
    if (!isTikTokConfigured()) return notConfigured(reply);
    const cfg = getTikTokConfig();
    const query = req.query as Record<string, string | undefined>;

    const sendBack = (ok: boolean, detail?: string) => {
      const url = new URL(cfg.frontendReturnUrl);
      url.searchParams.set("tiktok", ok ? "connected" : "error");
      if (detail) url.searchParams.set("reason", detail);
      return reply.redirect(url.toString());
    };

    if (query.error) return sendBack(false, query.error);
    if (!query.code || !query.state)
      return sendBack(false, "missing_code_or_state");

    const userId = await redis.get(stateKey(query.state));
    if (!userId) return sendBack(false, "invalid_or_expired_state");
    await redis.del(stateKey(query.state));

    try {
      const token = await exchangeCodeForToken(query.code);

      // Enrich the stored profile from the user.info.basic scope when granted.
      let profile:
        | { displayName?: string | null; avatarUrl?: string | null }
        | undefined;
      if (capabilitiesFromScopes(token.scope).canReadProfile) {
        try {
          const info = await fetchUserInfo(token.access_token);
          profile = {
            displayName: info.display_name ?? null,
            avatarUrl: info.avatar_url ?? null,
          };
        } catch (e) {
          req.log.warn({ e }, "TikTok user info fetch failed (non-fatal)");
        }
      }

      await upsertFromTokenResponse(userId, token, profile);
      return sendBack(true);
    } catch (err) {
      req.log.error(err);
      const reason =
        err instanceof TikTokApiError ? "tiktok_api_error" : "exchange_failed";
      return sendBack(false, reason);
    }
  }

  static async disconnect(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req as any).userId as string;
    await disconnect(userId);
    return reply.send({ disconnected: true });
  }

  /** Read the connected user's profile (scope: user.info.basic). */
  static async userInfo(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req as any).userId as string;
    const caps = await loadCapabilities(userId);
    if (!caps)
      return reply
        .status(409)
        .send({
          error: "TIKTOK_NOT_CONNECTED",
          message: "No TikTok account connected.",
        });
    if (!caps.capabilities.canReadProfile)
      return scopeMissing(reply, "user.info.basic");

    try {
      const accessToken = await getValidAccessToken(userId);
      const info = await fetchUserInfo(accessToken);
      return reply.send(info);
    } catch (err) {
      return mapTikTokError(reply, err);
    }
  }

  /** List the connected user's own videos (scope: video.list). */
  static async videos(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req as any).userId as string;
    const { cursor, maxCount } = VideoListQuerySchema.parse(req.query);

    const caps = await loadCapabilities(userId);
    if (!caps)
      return reply
        .status(409)
        .send({
          error: "TIKTOK_NOT_CONNECTED",
          message: "No TikTok account connected.",
        });
    if (!caps.capabilities.canListVideos)
      return scopeMissing(reply, "video.list");

    try {
      const accessToken = await getValidAccessToken(userId);
      const result = await listUserVideos(accessToken, { cursor, maxCount });
      return reply.send(result);
    } catch (err) {
      return mapTikTokError(reply, err);
    }
  }

  /** Creator info — privacy options must be shown before a Direct Post. */
  static async creatorInfo(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req as any).userId as string;
    const caps = await loadCapabilities(userId);
    if (!caps)
      return reply
        .status(409)
        .send({
          error: "TIKTOK_NOT_CONNECTED",
          message: "No TikTok account connected.",
        });
    if (!caps.capabilities.canPublish)
      return scopeMissing(reply, "video.publish");

    try {
      const accessToken = await getValidAccessToken(userId);
      const info = await queryCreatorInfo(accessToken);
      return reply.send(info);
    } catch (err) {
      return mapTikTokError(reply, err);
    }
  }

  /** Publish a video by URL (PULL_FROM_URL) — Direct Post or draft. */
  static async publish(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req as any).userId as string;
    const body = PublishBodySchema.parse(req.body);

    const caps = await loadCapabilities(userId);
    if (!caps)
      return reply
        .status(409)
        .send({
          error: "TIKTOK_NOT_CONNECTED",
          message: "No TikTok account connected.",
        });

    const needed = body.draftOnly ? "video.upload" : "video.publish";
    const allowed = body.draftOnly
      ? caps.capabilities.canUploadDraft
      : caps.capabilities.canPublish;
    if (!allowed) return scopeMissing(reply, needed);

    try {
      const accessToken = await getValidAccessToken(userId);
      const source = {
        kind: "PULL_FROM_URL" as const,
        videoUrl: body.videoUrl,
      };

      const result = body.draftOnly
        ? await initInboxUpload(accessToken, source)
        : await initDirectPost(
            accessToken,
            {
              title: body.title,
              privacyLevel: body.privacyLevel as PrivacyLevel,
              disableComment: body.disableComment,
              disableDuet: body.disableDuet,
              disableStitch: body.disableStitch,
            },
            source,
          );

      return reply.status(202).send({
        publishId: result.publishId,
        mode: body.draftOnly ? "draft" : "direct_post",
      });
    } catch (err) {
      return mapTikTokError(reply, err);
    }
  }

  /** Poll the status of a publish_id. */
  static async status_publish(req: FastifyRequest, reply: FastifyReply) {
    const userId = (req as any).userId as string;
    const { publishId } = req.params as { publishId: string };

    try {
      const accessToken = await getValidAccessToken(userId);
      const status = await fetchPublishStatus(accessToken, publishId);
      return reply.send(status);
    } catch (err) {
      return mapTikTokError(reply, err);
    }
  }
}
