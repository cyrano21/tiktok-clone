import { z } from 'zod';
import { capabilitiesFromScopes } from '@/server/tiktok/config';
import { listUserVideos } from '@/server/tiktok/service';
import { getAccount, getValidAccessToken } from '@/server/tiktok/store';
import {
  resolveUserId,
  json,
  notConnected,
  scopeMissing,
  mapTikTokError,
} from '@/server/tiktok/http';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  maxCount: z.coerce.number().int().min(1).max(20).optional(),
});

/** List the connected user's own videos (scope: video.list). */
export async function GET(req: Request) {
  const userId = resolveUserId(req);
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    cursor: url.searchParams.get('cursor') ?? undefined,
    maxCount: url.searchParams.get('maxCount') ?? undefined,
  });
  if (!parsed.success) {
    return json(
      { error: 'BAD_REQUEST', message: 'Invalid cursor/maxCount.' },
      400,
    );
  }

  const acc = getAccount(userId);
  if (!acc) return notConnected();
  if (!capabilitiesFromScopes(acc.scope).canListVideos) {
    return scopeMissing('video.list');
  }

  try {
    const accessToken = await getValidAccessToken(userId);
    const result = await listUserVideos(accessToken, parsed.data);
    return json(result);
  } catch (err) {
    return mapTikTokError(err);
  }
}
