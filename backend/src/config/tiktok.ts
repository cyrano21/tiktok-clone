/**
 * TikTok integration configuration.
 *
 * Centralizes every TikTok-related constant and credential so the rest of the
 * codebase never reads `process.env.TIKTOK_*` directly. This keeps a single
 * source of truth and makes it trivial to swap endpoints (sandbox vs prod) or
 * inject test config later.
 *
 * The client secret is read here and used ONLY inside backend services.
 * It must never be sent to, or referenced from, the frontend.
 */

export const TIKTOK_OAUTH_AUTHORIZE_URL =
  "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_OAUTH_TOKEN_URL =
  "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

export const TIKTOK_ENDPOINTS = {
  userInfo: `${TIKTOK_API_BASE}/user/info/`,
  videoList: `${TIKTOK_API_BASE}/video/list/`,
  creatorInfoQuery: `${TIKTOK_API_BASE}/post/publish/creator_info/query/`,
  videoInit: `${TIKTOK_API_BASE}/post/publish/video/init/`,
  statusFetch: `${TIKTOK_API_BASE}/post/publish/status/fetch/`,
} as const;

/**
 * Every scope this integration knows how to use, mapped to the product/feature
 * it unlocks. Requesting a scope the app is NOT approved for makes TikTok reject
 * the whole consent screen, so the requested set must match the approved app.
 *
 * - user.info.basic: read open_id / avatar / display name        (Login Kit)
 * - video.list:      read the user's own public videos           (Login Kit)
 * - video.publish:   Direct Post to the user's profile           (Content Posting API)
 * - video.upload:    Upload to drafts/inbox to finish in-app      (Content Posting API)
 */
export const TIKTOK_KNOWN_SCOPES = {
  userInfo: "user.info.basic",
  videoList: "video.list",
  videoPublish: "video.publish",
  videoUpload: "video.upload",
} as const;

export type TikTokScope =
  (typeof TIKTOK_KNOWN_SCOPES)[keyof typeof TIKTOK_KNOWN_SCOPES];

/**
 * Default scopes for the CURRENTLY APPROVED app (Login Kit only):
 * profile read + video list. Publishing scopes are intentionally excluded
 * because the app is not yet approved for the Content Posting API — including
 * them would break the OAuth consent screen.
 *
 * Override with the `TIKTOK_SCOPES` env var (comma-separated) once the app is
 * approved for publishing, e.g.
 *   TIKTOK_SCOPES=user.info.basic,video.list,video.publish,video.upload
 */
export const TIKTOK_DEFAULT_SCOPES: TikTokScope[] = [
  TIKTOK_KNOWN_SCOPES.userInfo,
  TIKTOK_KNOWN_SCOPES.videoList,
];

function parseScopes(raw: string | undefined): string {
  const cleaned = (raw ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return (cleaned.length ? cleaned : TIKTOK_DEFAULT_SCOPES).join(",");
}

export interface TikTokConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  /** Where the backend bounces the browser back to after a successful connect. */
  frontendReturnUrl: string;
  /** Comma-separated scope string actually requested at authorize time. */
  scopes: string;
}

export function getTikTokConfig(): TikTokConfig {
  return {
    clientKey: process.env.TIKTOK_CLIENT_KEY ?? "",
    clientSecret: process.env.TIKTOK_CLIENT_SECRET ?? "",
    redirectUri: process.env.TIKTOK_REDIRECT_URI ?? "",
    frontendReturnUrl:
      process.env.TIKTOK_FRONTEND_RETURN_URL ?? "http://127.0.0.1:5173/",
    scopes: parseScopes(process.env.TIKTOK_SCOPES),
  };
}

/** Parse a granted/requested scope string into a Set for capability checks. */
export function scopeSet(scopes: string): Set<string> {
  return new Set(
    scopes
      .split(/[ ,]+/)
      .map(s => s.trim())
      .filter(Boolean),
  );
}

/**
 * Capabilities derived from a set of granted scopes. The frontend uses this to
 * decide which actions to surface; the backend uses it to gate endpoints so a
 * missing scope returns a clear 403 instead of an opaque TikTok error.
 */
export interface TikTokCapabilities {
  canReadProfile: boolean;
  canListVideos: boolean;
  canPublish: boolean;
  canUploadDraft: boolean;
}

export function capabilitiesFromScopes(scopes: string): TikTokCapabilities {
  const set = scopeSet(scopes);
  return {
    canReadProfile: set.has(TIKTOK_KNOWN_SCOPES.userInfo),
    canListVideos: set.has(TIKTOK_KNOWN_SCOPES.videoList),
    canPublish: set.has(TIKTOK_KNOWN_SCOPES.videoPublish),
    canUploadDraft: set.has(TIKTOK_KNOWN_SCOPES.videoUpload),
  };
}

/**
 * True only when the operator has supplied real approved-app credentials.
 * Routes use this to return an explicit, honest 503 instead of failing
 * obscurely against TikTok with empty credentials.
 */
export function isTikTokConfigured(): boolean {
  const cfg = getTikTokConfig();
  return Boolean(cfg.clientKey && cfg.clientSecret && cfg.redirectUri);
}
