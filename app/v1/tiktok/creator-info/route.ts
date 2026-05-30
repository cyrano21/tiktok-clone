import { capabilitiesFromScopes } from '@/server/tiktok/config';
import { queryCreatorInfo } from '@/server/tiktok/service';
import { getAccount, getValidAccessToken } from '@/server/tiktok/store';
import {
  resolveUserId,
  json,
  notConnected,
  scopeMissing,
  mapTikTokError,
} from '@/server/tiktok/http';

export const dynamic = 'force-dynamic';

/** Creator info — privacy options shown before a Direct Post (scope: video.publish). */
export async function GET(req: Request) {
  const userId = resolveUserId(req);
  const acc = getAccount(userId);
  if (!acc) return notConnected();
  if (!capabilitiesFromScopes(acc.scope).canPublish) {
    return scopeMissing('video.publish');
  }

  try {
    const accessToken = await getValidAccessToken(userId);
    const info = await queryCreatorInfo(accessToken);
    return json(info);
  } catch (err) {
    return mapTikTokError(err);
  }
}
