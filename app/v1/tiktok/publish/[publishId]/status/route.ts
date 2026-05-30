import { fetchPublishStatus } from '@/server/tiktok/service';
import { getValidAccessToken } from '@/server/tiktok/store';
import { resolveUserId, json, mapTikTokError } from '@/server/tiktok/http';

export const dynamic = 'force-dynamic';

/** Poll the status of a publish_id. */
export async function GET(
  req: Request,
  { params }: { params: { publishId: string } },
) {
  const userId = resolveUserId(req);
  const publishId = params.publishId;
  if (!publishId) {
    return json({ error: 'BAD_REQUEST', message: 'Missing publishId.' }, 400);
  }

  try {
    const accessToken = await getValidAccessToken(userId);
    const status = await fetchPublishStatus(accessToken, publishId);
    return json(status);
  } catch (err) {
    return mapTikTokError(err);
  }
}
