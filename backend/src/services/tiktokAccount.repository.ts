/**
 * Persistence + token-lifecycle for connected TikTok accounts.
 *
 * OAuth credentials are encrypted before they reach Prisma. Existing plaintext
 * rows remain readable for rolling migration and are rewritten encrypted on the
 * next OAuth upsert or token refresh.
 */

import { prisma } from "../config/database";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "../config/token-encryption";
import { refreshAccessToken, type TikTokTokenResponse } from "./tiktok.service";

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
    accessToken: encryptSecret(token.access_token),
    refreshToken: encryptSecret(token.refresh_token),
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

/** Internal database row. Callers must never serialize token columns. */
async function getStoredAccount(userId: string) {
  return prisma.tikTokAccount.findUnique({ where: { userId } });
}

/** Capability lookup deliberately excludes OAuth token columns. */
export async function getAccount(userId: string) {
  return prisma.tikTokAccount.findUnique({
    where: { userId },
    select: { scope: true },
  });
}

export async function getSummary(
  userId: string,
): Promise<ConnectedAccountSummary | null> {
  const acc = await getStoredAccount(userId);
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

async function migrateLegacyTokens(userId: string, accessToken: string, refreshToken: string) {
  if (isEncryptedSecret(accessToken) && isEncryptedSecret(refreshToken)) return;
  await prisma.tikTokAccount.update({
    where: { userId },
    data: {
      accessToken: isEncryptedSecret(accessToken) ? accessToken : encryptSecret(accessToken),
      refreshToken: isEncryptedSecret(refreshToken) ? refreshToken : encryptSecret(refreshToken),
    },
  });
}

/** Returns a currently-valid plaintext access token only in process memory. */
export async function getValidAccessToken(userId: string): Promise<string> {
  const acc = await getStoredAccount(userId);
  if (!acc) throw new TikTokNotConnectedError();

  const accessToken = decryptSecret(acc.accessToken);
  const refreshToken = decryptSecret(acc.refreshToken);
  await migrateLegacyTokens(userId, acc.accessToken, acc.refreshToken);

  const stillValid =
    acc.accessTokenExpiresAt.getTime() - EXPIRY_SKEW_MS > Date.now();
  if (stillValid) return accessToken;

  if (acc.refreshTokenExpiresAt.getTime() <= Date.now()) {
    throw new TikTokRefreshExpiredError();
  }

  const refreshed = await refreshAccessToken(refreshToken);
  await upsertFromTokenResponse(userId, refreshed);
  return refreshed.access_token;
}
