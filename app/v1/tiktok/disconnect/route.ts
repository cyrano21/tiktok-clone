import { disconnect } from '@/server/tiktok/store';
import { resolveUserId, json } from '@/server/tiktok/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const userId = resolveUserId(req);
  disconnect(userId);
  return json({ disconnected: true });
}
