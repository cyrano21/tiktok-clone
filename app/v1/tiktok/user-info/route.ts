import { capabilitiesFromScopes } from '@/server/tiktok/config';
import { fetchUserInfo } from '@/server/tiktok/service';
import { getAccount, getValidAccessToken } from '@/server/tiktok/store';
import {
  resolveUserId,
  json,
  notConnected,
  scopeMissing,
  mapTikTokError,
} from '@/server/tiktok/http';

export const dynamic = 'force-dynamic';

/** Read the connected user's profile (scope: user.info.basic). */
export async function GET(req: Request) {
  const userId = resolveUserId(req);
  const acc = getAccount(userId);
  if (!acc) return notConnected();
  if (!capabilitiesFromScopes(acc.scope).canReadProfile) {
    return scopeMissing('user.info.basic');
  }

  try {
    const accessToken = await getValidAccessToken(userId);
    const info = await fetchUserInfo(accessToken);
    return json(info);
  } catch (err) {
    return mapTikTokError(err);
  }
}
