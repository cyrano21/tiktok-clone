/**
 * TikTok account + OAuth-state persistence and token lifecycle.
 *
 * The original Fastify backend used Postgres (Prisma) for token storage and
 * Redis for the OAuth `state` nonce. This Next.js deployment runs as a single
 * static-ish app with no provisioned datastore, so we use an in-process store
 * behind a narrow interface. It owns:
 *   - storing/updating tokens after OAuth
 *   - returning a *valid* access token (auto-refreshing when expired)
 *   - short-lived OAuth state nonces
 *
 * The interface is intentionally minimal so a Redis/DB-backed implementation
 * can replace it later without touching the route handlers.
 *
 * NOTE: in-memory state resets on server restart and is not shared across
 * instances. For the current single-instance Coolify deployment that is
 * acceptable; multi-instance scaling would require a shared store here.
 */

import { refreshAccessToken, type TikTokTokenResponse } from './service';

const EXPIRY_SKEW_MS = 60_000;

interface StoredAccount {
  userId: string;
  openId: string;
  scope: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: number;
}

export interface ConnectedAccountSummary {
  openId: string;
  displayName: string | null;
  avatarUrl: string | null;
  scope: string;
  connectedAt: string;
}

export class TikTokNotConnectedError extends Error {
  constructor() {
    super('No TikTok account connected for this user');
    this.name = 'TikTokNotConnectedError';
  }
}

export class TikTokRefreshExpiredError extends Error {
  constructor() {
    super('TikTok refresh token expired — user must reconnect');
    this.name = 'TikTokRefreshExpiredError';
  }
}

/**
 * Module-level singletons survive across requests within one server process.
 * Guard against Next.js dev hot-reload recreating the module by stashing on
 * globalThis.
 */
interface TikTokGlobalStore {
  accounts: Map<string, StoredAccount>;
  states: Map<string, { userId: string; expiresAt: number }>;
}

const g = globalThis as unknown as { __tiktokStore?: TikTokGlobalStore };
const store: TikTokGlobalStore =
  g.__tiktokStore ??
  (g.__tiktokStore = { accounts: new Map(), states: new Map() });

/* ----------------------------- OAuth state ----------------------------- */

const STATE_TTL_MS = 600_000; // 10 minutes

export function saveState(state: string, userId: string): void {
  store.states.set(state, { userId, expiresAt: Date.now() + STATE_TTL_MS });
}

export function consumeState(state: string): string | null {
  const entry = store.states.get(state);
  if (!entry) return null;
  store.states.delete(state);
  if (entry.expiresAt < Date.now()) return null;
  return entry.userId;
}

/* ----------------------------- Accounts -------------------------------- */

export function upsertFromTokenResponse(
  userId: string,
  token: TikTokTokenResponse,
  profile?: { displayName?: string | null; avatarUrl?: string | null },
): void {
  const existing = store.accounts.get(userId);
  store.accounts.set(userId, {
    userId,
    openId: token.open_id,
    scope: token.scope,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    accessTokenExpiresAt: Date.now() + token.expires_in * 1000,
    refreshTokenExpiresAt: Date.now() + token.refresh_expires_in * 1000,
    displayName:
      profile?.displayName ?? existing?.displayName ?? null,
    avatarUrl: profile?.avatarUrl ?? existing?.avatarUrl ?? null,
    createdAt: existing?.createdAt ?? Date.now(),
  });
}

export function getAccount(userId: string): StoredAccount | undefined {
  return store.accounts.get(userId);
}

export function getSummary(userId: string): ConnectedAccountSummary | null {
  const acc = store.accounts.get(userId);
  if (!acc) return null;
  return {
    openId: acc.openId,
    displayName: acc.displayName,
    avatarUrl: acc.avatarUrl,
    scope: acc.scope,
    connectedAt: new Date(acc.createdAt).toISOString(),
  };
}

export function disconnect(userId: string): void {
  store.accounts.delete(userId);
}

/**
 * Returns a currently-valid access token, refreshing transparently when within
 * the expiry skew window.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const acc = store.accounts.get(userId);
  if (!acc) throw new TikTokNotConnectedError();

  const stillValid = acc.accessTokenExpiresAt - EXPIRY_SKEW_MS > Date.now();
  if (stillValid) return acc.accessToken;

  if (acc.refreshTokenExpiresAt <= Date.now()) {
    throw new TikTokRefreshExpiredError();
  }

  const refreshed = await refreshAccessToken(acc.refreshToken);
  upsertFromTokenResponse(userId, refreshed);
  return refreshed.access_token;
}
