import { randomUUID } from 'crypto';
import { isTikTokConfigured } from '@/server/tiktok/config';
import { buildAuthorizeUrl } from '@/server/tiktok/service';
import { saveState } from '@/server/tiktok/store';
import { resolveUserId, json, notConfigured } from '@/server/tiktok/http';

export const dynamic = 'force-dynamic';

/** Step 1: return TikTok's consent-screen URL for the client to redirect to. */
export async function GET(req: Request) {
  if (!isTikTokConfigured()) return notConfigured();

  const userId = resolveUserId(req);
  const state = randomUUID();
  saveState(state, userId);

  return json({ authorizeUrl: buildAuthorizeUrl(state) });
}
