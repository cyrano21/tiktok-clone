import { NextRequest, NextResponse } from 'next/server';
import {
  backendAuthUrl,
  clearRefreshCookie,
  noStore,
  proxyJson,
  sameOriginRequest,
} from '../_server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) {
    return noStore(NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 }));
  }
  const authorization = request.headers.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    try {
      await proxyJson(backendAuthUrl('logout'), {
        method: 'POST',
        headers: { authorization, accept: 'application/json' },
      });
    } catch {
      // Cookie clearing is still authoritative locally. The access token is
      // short-lived; backend revocation remains best effort if the API is down.
    }
  }
  const response = NextResponse.json({ success: true });
  clearRefreshCookie(response);
  return noStore(response);
}
