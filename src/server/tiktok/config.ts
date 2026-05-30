/**
 * TikTok integration configuration (server-only).
 *
 * Single source of truth for every TikTok constant + credential. The rest of
 * the server code never reads `process.env.TIKTOK_*` directly. The client
 * secret is read here and used ONLY inside server route handlers/services — it
 * is never sent to or referenced from the browser bundle.
 */

export const TIKTOK_OAUTH_AUTHORIZE_URL =
  'https://www.tiktok.com/v2/auth/authorize/';
export const TIKTOK_OAUTH_TOKEN_URL =
  'https://open.tiktokapis.com/v2/oauth/token/';
export const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export const TIKTOK_ENDPOINTS = {
  userInfo: `${TIKTOK_API_BASE}/user/info/`,
  videoList: `${TIKTOK_API_BASE}/video/list/`,
  creatorInfoQuery: `${TIKTOK_API_BASE}/post/publish/creator_info/query/`,
  videoInit: `${TIKTOK_API_BASE}/post/publish/video/init/`,
  statusFetch: `${TIKTOK_API_BASE}/post/publish/status/fetch/`,
} as const;

export const TIKTOK_KNOWN_SCOPES = {
  userInfo: 'user.info.basic',
  videoList: 'video.list',
  videoPublish: 'video.publish',
  videoUpload: 'video.upload',
} as const;

export type TikTokScope =
  (typeof TIKTOK_KNOWN_SCOPES)[keyof typeof TIKTOK_KNOWN_SCOPES];

/** Login Kit scopes — the set the current app is approved for. */
export const TIKTOK_DEFAULT_SCOPES: TikTokScope[] = [
  TIKTOK_KNOWN_SCOPES.userInfo,
  TIKTOK_KNOWN_SCOPES.videoList,
];

function parseScopes(raw: string | undefined): string {
  const cleaned = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (cleaned.length ? cleaned : TIKTOK_DEFAULT_SCOPES).join(',');
}

export interface TikTokConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  frontendReturnUrl: string;
  scopes: string;
}

export function getTikTokConfig(): TikTokConfig {
  return {
    clientKey: process.env.TIKTOK_CLIENT_KEY ?? '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET ?? '',
    redirectUri: process.env.TIKTOK_REDIRECT_URI ?? '',
    frontendReturnUrl: process.env.TIKTOK_FRONTEND_RETURN_URL ?? '/',
    scopes: parseScopes(process.env.TIKTOK_SCOPES),
  };
}

export function scopeSet(scopes: string): Set<string> {
  return new Set(
    scopes
      .split(/[ ,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

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

export function isTikTokConfigured(): boolean {
  const cfg = getTikTokConfig();
  return Boolean(cfg.clientKey && cfg.clientSecret && cfg.redirectUri);
}
