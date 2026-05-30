import {
  getTikTokConfig,
  isTikTokConfigured,
  capabilitiesFromScopes,
} from '@/server/tiktok/config';
import { getSummary } from '@/server/tiktok/store';
import { resolveUserId, json } from '@/server/tiktok/http';

export const dynamic = 'force-dynamic';

/** Connection status + capabilities (used by the frontend to pick actions). */
export async function GET(req: Request) {
  const userId = resolveUserId(req);
  const summary = getSummary(userId);
  const cfg = getTikTokConfig();

  // Connected → capabilities reflect granted scopes; otherwise what we'll request.
  const capabilities = capabilitiesFromScopes(summary?.scope ?? cfg.scopes);

  return json({
    configured: isTikTokConfigured(),
    connected: Boolean(summary),
    account: summary,
    requestedScopes: cfg.scopes,
    capabilities,
  });
}
