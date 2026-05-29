/**
 * Persistence + token-lifecycle for connected TikTok accounts.
 *
 * This is the single source of truth for a user's TikTok credentials. It owns:
 *  - storing/updating tokens after OAuth
 *  - returning a *valid* access token (auto-refreshing when expired)
 *
 * The HTTP layer never touches the DB columns directly and never refreshes
 * tokens by hand — it asks this module for a ready-to-use access token.
 */

import { prisma } from "../config/database";
import { refreshAccessToken, type TikTokTokenResponse } from "./tiktok.service";

/** 60s safety window so we refresh slightly before real expiry. */
const EXPIRY_SKEW_MS = 60_000;

export interface ConnectedAccountSummary {
  openId: string;
  displayName: string | null;
  avatarUrl: string | null;
  scope: string;
  connectedAt: Date;
}

function expiryDate(secondsFromNow: number): Date {
  return new Date(Date.now() + secondsFromNow * 1000);
}

export async function upsertFromTokenResponse(
  userId: string,
  token: TikTokTokenResponse,
  profile?: { displayName?: string | null; avatarUrl?: string | null },
): Promise<void> {
  const data = {
    openId: token.open_id,
    scope: token.scope,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    accessTokenExpiresAt: expiryDate(token.expires_in),
    refreshTokenExpiresAt: expiryDate(token.refresh_expires_in),
    displayName: profile?.displayName ?? undefined,
    avatarUrl: profile?.avatarUrl ?? undefined,
  };

  await prisma.tikTokAccount.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export async function getAccount(userId: string) {
  return prisma.tikTokAccount.findUnique({ where: { userId } });
}

export async function getSummary(
  userId: string,
): Promise<ConnectedAccountSummary | null> {
  const acc = await getAccount(userId);
  if (!acc) return null;
  return {
    openId: acc.openId,
    displayName: acc.displayName,
    avatarUrl: acc.avatarUrl,
    scope: acc.scope,
    connectedAt: acc.createdAt,
  };
}

export async function disconnect(userId: string): Promise<void> {
  await prisma.tikTokAccount.deleteMany({ where: { userId } });
}

export class TikTokNotConnectedError extends Error {
  constructor() {
    super("No TikTok account connected for this user");
    this.name = "TikTokNotConnectedError";
  }
}

export class TikTokRefreshExpiredError extends Error {
  constructor() {
    super("TikTok refresh token expired — user must reconnect");
    this.name = "TikTokRefreshExpiredError";
  }
}

/**
 * Returns a currently-valid access token for the user, refreshing it
 * transparently when it is within the expiry skew window.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const acc = await getAccount(userId);
  if (!acc) throw new TikTokNotConnectedError();

  const stillValid =
    acc.accessTokenExpiresAt.getTime() - EXPIRY_SKEW_MS > Date.now();
  if (stillValid) return acc.accessToken;

  if (acc.refreshTokenExpiresAt.getTime() <= Date.now()) {
    throw new TikTokRefreshExpiredError();
  }

  const refreshed = await refreshAccessToken(acc.refreshToken);
  await upsertFromTokenResponse(userId, refreshed);
  return refreshed.access_token;
}
