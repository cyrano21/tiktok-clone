import { NextResponse } from 'next/server';
import { getTikTokConfig, isTikTokConfigured, capabilitiesFromScopes } from '@/server/tiktok/config';
import {
  exchangeCodeForToken,
  fetchUserInfo,
  TikTokApiError,
} from '@/server/tiktok/service';
import { consumeState, upsertFromTokenResponse } from '@/server/tiktok/store';

export const dynamic = 'force-dynamic';

/**
 * Step 2: TikTok redirects the browser here with ?code & ?state.
 *
 * The user is matched via the one-time `state` nonce saved at authorize time.
 * On success/failure we bounce back to the frontend return URL with a
 * `?tiktok=connected|error` flag the UI reads on mount.
 */
export async function GET(req: Request) {
  const cfg = getTikTokConfig();
  const requestUrl = new URL(req.url);
  // Resolve the return target against the current origin when it is relative.
  const returnBase = cfg.frontendReturnUrl || '/';

  const sendBack = (ok: boolean, detail?: string) => {
    const url = new URL(returnBase, requestUrl.origin);
    url.searchParams.set('tiktok', ok ? 'connected' : 'error');
    if (detail) url.searchParams.set('reason', detail);
    return NextResponse.redirect(url.toString());
  };

  if (!isTikTokConfigured()) return sendBack(false, 'not_configured');

  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const oauthError = requestUrl.searchParams.get('error');

  if (oauthError) return sendBack(false, oauthError);
  if (!code || !state) return sendBack(false, 'missing_code_or_state');

  const userId = consumeState(state);
  if (!userId) return sendBack(false, 'invalid_or_expired_state');

  try {
    const token = await exchangeCodeForToken(code);

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
      } catch {
        // Non-fatal: profile enrichment failed, connection still succeeds.
      }
    }

    upsertFromTokenResponse(userId, token, profile);
    return sendBack(true);
  } catch (err) {
    const reason =
      err instanceof TikTokApiError ? 'tiktok_api_error' : 'exchange_failed';
    return sendBack(false, reason);
  }
}
