/**
 * Frontend client for the official TikTok integration exposed by our backend
 * (`/v1/tiktok/*`). This NEVER touches TikTok directly and never holds the
 * client secret — it only orchestrates the OAuth redirect and the publish
 * calls against our own API.
 *
 * Design notes:
 *  - The backend base URL is configurable (Vite env `VITE_API_BASE_URL`),
 *    defaulting to the local Fastify server.
 *  - Every call degrades honestly: if the backend is unreachable or the
 *    integration is not configured (no approved TikTok app keys yet), callers
 *    receive a typed result and can fall back to the manual upload flow.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "@auth_token";

function resolveApiBase(): string {
  // Allow a runtime override (e.g. set on window in index.html or by Vite's
  // `define`) without depending on `import.meta` (incompatible with the
  // project's commonjs tsconfig). Falls back to the local Fastify server.
  const override =
    typeof globalThis !== "undefined" &&
    (globalThis as any).__TIKTOK_API_BASE__;
  return (
    (typeof override === "string" && override) || "http://localhost:3000/v1"
  );
}

const API_BASE = resolveApiBase();

export interface TikTokAccountSummary {
  openId: string;
  displayName: string | null;
  avatarUrl: string | null;
  scope: string;
  connectedAt: string;
}

export interface TikTokCapabilities {
  canReadProfile: boolean;
  canListVideos: boolean;
  canPublish: boolean;
  canUploadDraft: boolean;
}

export interface TikTokStatus {
  configured: boolean;
  connected: boolean;
  account: TikTokAccountSummary | null;
  requestedScopes: string;
  capabilities: TikTokCapabilities;
}

export type TikTokResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: TikTokFailureCode; message: string };

export type TikTokFailureCode =
  | "NETWORK"
  | "NOT_AUTHENTICATED"
  | "NOT_CONFIGURED"
  | "NOT_CONNECTED"
  | "RECONNECT_REQUIRED"
  | "SCOPE_MISSING"
  | "API_ERROR"
  | "UNKNOWN";

async function authHeader(): Promise<Record<string, string>> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function mapHttpError(
  status: number,
  body: any,
): { code: TikTokFailureCode; message: string } {
  const message = body?.message || `Erreur HTTP ${status}`;
  switch (body?.error) {
    case "TIKTOK_NOT_CONFIGURED":
      return { code: "NOT_CONFIGURED", message };
    case "TIKTOK_NOT_CONNECTED":
      return { code: "NOT_CONNECTED", message };
    case "TIKTOK_RECONNECT_REQUIRED":
      return { code: "RECONNECT_REQUIRED", message };
    case "TIKTOK_SCOPE_MISSING":
      return { code: "SCOPE_MISSING", message };
    case "TIKTOK_API_ERROR":
      return { code: "API_ERROR", message };
    default:
      if (status === 401) return { code: "NOT_AUTHENTICATED", message };
      return { code: "UNKNOWN", message };
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<TikTokResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader()),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch (err) {
    return {
      ok: false,
      code: "NETWORK",
      message:
        "Backend TikTok injoignable. Lance le serveur (backend) ou utilise la publication manuelle.",
    };
  }

  let body: any = null;
  try {
    const text = await res.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    /* tolerate empty body */
  }

  if (!res.ok) {
    const { code, message } = mapHttpError(res.status, body);
    return { ok: false, code, message };
  }
  return { ok: true, data: body as T };
}

/** Read whether the integration is configured and the user is connected. */
export function getTikTokStatus(): Promise<TikTokResult<TikTokStatus>> {
  return request<TikTokStatus>("/tiktok/status", { method: "GET" });
}

/**
 * Start the OAuth flow: ask the backend for the authorize URL, then send the
 * browser to TikTok's consent screen. After consent TikTok redirects to the
 * backend callback, which bounces back to the app with `?tiktok=connected`.
 */
export async function connectTikTok(): Promise<
  TikTokResult<{ redirected: boolean }>
> {
  const res = await request<{ authorizeUrl: string }>("/tiktok/authorize", {
    method: "GET",
  });
  if (!res.ok) return res;
  if (typeof window !== "undefined" && res.data?.authorizeUrl) {
    window.location.assign(res.data.authorizeUrl);
    return { ok: true, data: { redirected: true } };
  }
  return { ok: true, data: { redirected: false } };
}

export function disconnectTikTok(): Promise<
  TikTokResult<{ disconnected: boolean }>
> {
  return request<{ disconnected: boolean }>("/tiktok/disconnect", {
    method: "POST",
  });
}

export interface TikTokUserInfo {
  open_id?: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
}

/** Read the connected user's basic profile (scope: user.info.basic). */
export function getTikTokUserInfo(): Promise<TikTokResult<TikTokUserInfo>> {
  return request<TikTokUserInfo>("/tiktok/user-info", { method: "GET" });
}

export interface TikTokVideoItem {
  id: string;
  title?: string;
  video_description?: string;
  cover_image_url?: string;
  share_url?: string;
  embed_link?: string;
  duration?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
  create_time?: number;
}

export interface TikTokVideoList {
  videos: TikTokVideoItem[];
  cursor?: number;
  hasMore: boolean;
}

/** List the connected user's own videos (scope: video.list). */
export function getTikTokVideos(
  opts: { cursor?: number; maxCount?: number } = {},
): Promise<TikTokResult<TikTokVideoList>> {
  const params = new URLSearchParams();
  if (opts.cursor) params.set("cursor", String(opts.cursor));
  if (opts.maxCount) params.set("maxCount", String(opts.maxCount));
  const qs = params.toString();
  return request<TikTokVideoList>(`/tiktok/videos${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

export interface PublishVideoInput {
  videoUrl: string;
  title: string;
  privacyLevel?:
    | "PUBLIC_TO_EVERYONE"
    | "MUTUAL_FOLLOW_FRIENDS"
    | "FOLLOWER_OF_CREATOR"
    | "SELF_ONLY";
  draftOnly?: boolean;
}

export interface PublishResult {
  publishId: string;
  mode: "draft" | "direct_post";
}

/**
 * Publish a video to TikTok through the backend Content Posting API.
 * The video must be reachable by a public URL (PULL_FROM_URL) approved in your
 * TikTok app's URL prefix settings.
 */
export function publishToTikTok(
  input: PublishVideoInput,
): Promise<TikTokResult<PublishResult>> {
  return request<PublishResult>("/tiktok/publish", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface PublishStatus {
  status: string;
  fail_reason?: string;
  publicaly_available_post_id?: string[];
}

export function getPublishStatus(
  publishId: string,
): Promise<TikTokResult<PublishStatus>> {
  return request<PublishStatus>(
    `/tiktok/publish/${encodeURIComponent(publishId)}/status`,
    {
      method: "GET",
    },
  );
}

/** Read `?tiktok=connected|error` from the return redirect, then clean the URL. */
export function readConnectRedirect(): {
  status: "connected" | "error";
  reason?: string;
} | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const tiktok = params.get("tiktok");
  if (tiktok !== "connected" && tiktok !== "error") return null;
  const reason = params.get("reason") ?? undefined;
  // Clean the query so a refresh doesn't re-trigger handling.
  params.delete("tiktok");
  params.delete("reason");
  const clean =
    window.location.pathname +
    (params.toString() ? `?${params.toString()}` : "") +
    window.location.hash;
  try {
    window.history.replaceState({}, "", clean);
  } catch {
    /* ignore */
  }
  return { status: tiktok, reason };
}
