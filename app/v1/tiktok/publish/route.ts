import { z } from 'zod';
import { capabilitiesFromScopes } from '@/server/tiktok/config';
import {
  initDirectPost,
  initInboxUpload,
  type PrivacyLevel,
} from '@/server/tiktok/service';
import { getAccount, getValidAccessToken } from '@/server/tiktok/store';
import {
  resolveUserId,
  json,
  notConnected,
  scopeMissing,
  mapTikTokError,
} from '@/server/tiktok/http';

export const dynamic = 'force-dynamic';

const PrivacyEnum = z.enum([
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
]);

const PublishBodySchema = z.object({
  videoUrl: z.string().url(),
  title: z.string().min(1).max(2200),
  privacyLevel: PrivacyEnum.default('SELF_ONLY'),
  disableComment: z.boolean().optional(),
  disableDuet: z.boolean().optional(),
  disableStitch: z.boolean().optional(),
  draftOnly: z.boolean().optional(),
});

/** Publish a video by URL (PULL_FROM_URL) — Direct Post or draft. */
export async function POST(req: Request) {
  const userId = resolveUserId(req);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'BAD_REQUEST', message: 'Invalid JSON body.' }, 400);
  }
  const parsed = PublishBodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      {
        error: 'BAD_REQUEST',
        message: parsed.error.issues.map((i) => i.message).join(', '),
      },
      400,
    );
  }
  const body = parsed.data;

  const acc = getAccount(userId);
  if (!acc) return notConnected();

  const caps = capabilitiesFromScopes(acc.scope);
  const needed = body.draftOnly ? 'video.upload' : 'video.publish';
  const allowed = body.draftOnly ? caps.canUploadDraft : caps.canPublish;
  if (!allowed) return scopeMissing(needed);

  try {
    const accessToken = await getValidAccessToken(userId);
    const source = { kind: 'PULL_FROM_URL' as const, videoUrl: body.videoUrl };

    const result = body.draftOnly
      ? await initInboxUpload(accessToken, source)
      : await initDirectPost(
          accessToken,
          {
            title: body.title,
            privacyLevel: body.privacyLevel as PrivacyLevel,
            disableComment: body.disableComment,
            disableDuet: body.disableDuet,
            disableStitch: body.disableStitch,
          },
          source,
        );

    return json(
      {
        publishId: result.publishId,
        mode: body.draftOnly ? 'draft' : 'direct_post',
      },
      202,
    );
  } catch (err) {
    return mapTikTokError(err);
  }
}
