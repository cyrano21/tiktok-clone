/**
 * TikTok service — owns ALL communication with TikTok's OAuth and
 * Content Posting API. Route handlers stay thin and never talk to TikTok
 * directly. Every external response is validated with zod so a malformed /
 * changed payload fails loudly at the boundary instead of leaking `any`.
 *
 * Docs:
 *  - OAuth:            https://developers.tiktok.com/doc/oauth-user-access-token-management
 *  - Content Posting:  https://developers.tiktok.com/doc/content-posting-api-get-started
 */

import { z } from 'zod';
import {
  TIKTOK_OAUTH_AUTHORIZE_URL,
  TIKTOK_OAUTH_TOKEN_URL,
  TIKTOK_ENDPOINTS,
  getTikTokConfig,
} from './config';

/* ------------------------------------------------------------------ *
 *  Errors
 * ------------------------------------------------------------------ */

export class TikTokApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 502,
    public readonly logId?: string,
  ) {
    super(message);
    this.name = 'TikTokApiError';
  }
}

/* ------------------------------------------------------------------ *
 *  Response schemas (validated boundaries)
 * ------------------------------------------------------------------ */

const TokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  open_id: z.string(),
  refresh_token: z.string(),
  refresh_expires_in: z.number(),
  scope: z.string(),
  token_type: z.string().optional(),
});
export type TikTokTokenResponse = z.infer<typeof TokenResponseSchema>;

const TikTokErrorEnvelope = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
  log_id: z.string().optional(),
});

const ApiErrorObject = z.object({
  code: z.string(),
  message: z.string(),
  log_id: z.string().optional(),
});

const CreatorInfoSchema = z.object({
  data: z.object({
    creator_avatar_url: z.string().optional(),
    creator_username: z.string().optional(),
    creator_nickname: z.string().optional(),
    privacy_level_options: z.array(z.string()).default([]),
    comment_disabled: z.boolean().optional(),
    duet_disabled: z.boolean().optional(),
    stitch_disabled: z.boolean().optional(),
    max_video_post_duration_sec: z.number().optional(),
  }),
  error: ApiErrorObject,
});
export type TikTokCreatorInfo = z.infer<typeof CreatorInfoSchema>['data'];

const PublishInitSchema = z.object({
  data: z.object({
    publish_id: z.string(),
    upload_url: z.string().optional(),
  }),
  error: ApiErrorObject,
});

const StatusFetchSchema = z.object({
  data: z.object({
    status: z.string(),
    fail_reason: z.string().optional(),
    publicaly_available_post_id: z.array(z.string()).optional(),
    uploaded_bytes: z.number().optional(),
  }),
  error: ApiErrorObject,
});
export type TikTokPublishStatus = z.infer<typeof StatusFetchSchema>['data'];

/* ------------------------------------------------------------------ *
 *  Domain types
 * ------------------------------------------------------------------ */

export type PrivacyLevel =
  | 'PUBLIC_TO_EVERYONE'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'FOLLOWER_OF_CREATOR'
  | 'SELF_ONLY';

export interface DirectPostOptions {
  title: string;
  privacyLevel: PrivacyLevel;
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

export type VideoSource =
  | { kind: 'PULL_FROM_URL'; videoUrl: string }
  | {
      kind: 'FILE_UPLOAD';
      videoSize: number;
      chunkSize: number;
      totalChunkCount: number;
    };

/* ------------------------------------------------------------------ *
 *  Low-level fetch helper
 * ------------------------------------------------------------------ */

async function tiktokFetch<S extends z.ZodTypeAny>(
  url: string,
  init: RequestInit,
  schema: S,
): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new TikTokApiError(
      `Network error calling TikTok: ${(err as Error).message}`,
      502,
    );
  }

  const raw = await res.text();
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new TikTokApiError(
      `TikTok returned non-JSON response (HTTP ${res.status})`,
      502,
    );
  }

  if (!res.ok) {
    const envelope = TikTokErrorEnvelope.safeParse(json);
    const apiErr = z.object({ error: ApiErrorObject }).safeParse(json);
    const message = apiErr.success
      ? `${apiErr.data.error.code}: ${apiErr.data.error.message}`
      : envelope.success
        ? `${envelope.data.error ?? 'tiktok_error'}: ${envelope.data.error_description ?? raw}`
        : `TikTok HTTP ${res.status}`;
    const logId = apiErr.success
      ? apiErr.data.error.log_id
      : envelope.success
        ? envelope.data.log_id
        : undefined;
    throw new TikTokApiError(
      message,
      res.status >= 500 ? 502 : res.status,
      logId,
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new TikTokApiError(
      `Unexpected TikTok payload shape: ${parsed.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}`,
      502,
    );
  }
  return parsed.data;
}

function assertApiOk(error: z.infer<typeof ApiErrorObject>) {
  if (error.code && error.code !== 'ok') {
    throw new TikTokApiError(
      `${error.code}: ${error.message}`,
      400,
      error.log_id,
    );
  }
}

/* ------------------------------------------------------------------ *
 *  OAuth
 * ------------------------------------------------------------------ */

export function buildAuthorizeUrl(state: string, codeChallenge?: string): string {
  const cfg = getTikTokConfig();
  const params = new URLSearchParams({
    client_key: cfg.clientKey,
    response_type: 'code',
    scope: cfg.scopes,
    redirect_uri: cfg.redirectUri,
    state,
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${TIKTOK_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  codeVerifier?: string,
): Promise<TikTokTokenResponse> {
  const cfg = getTikTokConfig();
  const body = new URLSearchParams({
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: cfg.redirectUri,
  });
  if (codeVerifier) body.set('code_verifier', codeVerifier);

  return tiktokFetch(
    TIKTOK_OAUTH_TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
    TokenResponseSchema,
  );
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TikTokTokenResponse> {
  const cfg = getTikTokConfig();
  const body = new URLSearchParams({
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  return tiktokFetch(
    TIKTOK_OAUTH_TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
    TokenResponseSchema,
  );
}

/* ------------------------------------------------------------------ *
 *  Display API (Login Kit scopes)
 * ------------------------------------------------------------------ */

const UserInfoSchema = z.object({
  data: z.object({
    user: z.object({
      open_id: z.string().optional(),
      union_id: z.string().optional(),
      avatar_url: z.string().optional(),
      display_name: z.string().optional(),
      bio_description: z.string().optional(),
      profile_deep_link: z.string().optional(),
      is_verified: z.boolean().optional(),
      follower_count: z.number().optional(),
      following_count: z.number().optional(),
      likes_count: z.number().optional(),
      video_count: z.number().optional(),
    }),
  }),
  error: ApiErrorObject,
});
export type TikTokUserInfo = z.infer<typeof UserInfoSchema>['data']['user'];

const USER_INFO_BASIC_FIELDS = [
  'open_id',
  'union_id',
  'avatar_url',
  'display_name',
] as const;

const VideoItemSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  video_description: z.string().optional(),
  cover_image_url: z.string().optional(),
  share_url: z.string().optional(),
  embed_link: z.string().optional(),
  duration: z.number().optional(),
  like_count: z.number().optional(),
  comment_count: z.number().optional(),
  share_count: z.number().optional(),
  view_count: z.number().optional(),
  create_time: z.number().optional(),
});
export type TikTokVideoItem = z.infer<typeof VideoItemSchema>;

const VideoListSchema = z.object({
  data: z.object({
    videos: z.array(VideoItemSchema).default([]),
    cursor: z.number().optional(),
    has_more: z.boolean().optional(),
  }),
  error: ApiErrorObject,
});

const VIDEO_LIST_FIELDS = [
  'id',
  'title',
  'video_description',
  'cover_image_url',
  'share_url',
  'embed_link',
  'duration',
  'like_count',
  'comment_count',
  'share_count',
  'view_count',
  'create_time',
] as const;

export async function fetchUserInfo(
  accessToken: string,
): Promise<TikTokUserInfo> {
  const url = `${TIKTOK_ENDPOINTS.userInfo}?fields=${USER_INFO_BASIC_FIELDS.join(',')}`;
  const result = await tiktokFetch(
    url,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    UserInfoSchema,
  );
  assertApiOk(result.error);
  return result.data.user;
}

export async function listUserVideos(
  accessToken: string,
  opts: { cursor?: number; maxCount?: number } = {},
): Promise<{ videos: TikTokVideoItem[]; cursor?: number; hasMore: boolean }> {
  const url = `${TIKTOK_ENDPOINTS.videoList}?fields=${VIDEO_LIST_FIELDS.join(',')}`;
  const body: Record<string, number> = { max_count: opts.maxCount ?? 20 };
  if (opts.cursor) body.cursor = opts.cursor;

  const result = await tiktokFetch(
    url,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(body),
    },
    VideoListSchema,
  );
  assertApiOk(result.error);
  return {
    videos: result.data.videos,
    cursor: result.data.cursor,
    hasMore: result.data.has_more ?? false,
  };
}

/* ------------------------------------------------------------------ *
 *  Content Posting API
 * ------------------------------------------------------------------ */

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
  };
}

export async function queryCreatorInfo(
  accessToken: string,
): Promise<TikTokCreatorInfo> {
  const result = await tiktokFetch(
    TIKTOK_ENDPOINTS.creatorInfoQuery,
    { method: 'POST', headers: authHeaders(accessToken) },
    CreatorInfoSchema,
  );
  assertApiOk(result.error);
  return result.data;
}

export async function initDirectPost(
  accessToken: string,
  options: DirectPostOptions,
  source: VideoSource,
): Promise<{ publishId: string; uploadUrl?: string }> {
  const post_info = {
    title: options.title,
    privacy_level: options.privacyLevel,
    disable_comment: options.disableComment ?? false,
    disable_duet: options.disableDuet ?? false,
    disable_stitch: options.disableStitch ?? false,
  };

  const source_info =
    source.kind === 'PULL_FROM_URL'
      ? { source: 'PULL_FROM_URL', video_url: source.videoUrl }
      : {
          source: 'FILE_UPLOAD',
          video_size: source.videoSize,
          chunk_size: source.chunkSize,
          total_chunk_count: source.totalChunkCount,
        };

  const result = await tiktokFetch(
    TIKTOK_ENDPOINTS.videoInit,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ post_info, source_info }),
    },
    PublishInitSchema,
  );
  assertApiOk(result.error);
  return {
    publishId: result.data.publish_id,
    uploadUrl: result.data.upload_url,
  };
}

export async function initInboxUpload(
  accessToken: string,
  source: VideoSource,
): Promise<{ publishId: string; uploadUrl?: string }> {
  const source_info =
    source.kind === 'PULL_FROM_URL'
      ? { source: 'PULL_FROM_URL', video_url: source.videoUrl }
      : {
          source: 'FILE_UPLOAD',
          video_size: source.videoSize,
          chunk_size: source.chunkSize,
          total_chunk_count: source.totalChunkCount,
        };

  const result = await tiktokFetch(
    `${TIKTOK_ENDPOINTS.videoInit.replace('/video/init/', '/inbox/video/init/')}`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ source_info }),
    },
    PublishInitSchema,
  );
  assertApiOk(result.error);
  return {
    publishId: result.data.publish_id,
    uploadUrl: result.data.upload_url,
  };
}

export async function fetchPublishStatus(
  accessToken: string,
  publishId: string,
): Promise<TikTokPublishStatus> {
  const result = await tiktokFetch(
    TIKTOK_ENDPOINTS.statusFetch,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ publish_id: publishId }),
    },
    StatusFetchSchema,
  );
  assertApiOk(result.error);
  return result.data;
}
