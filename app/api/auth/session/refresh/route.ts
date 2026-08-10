import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_COOKIE,
  backendAuthUrl,
  clearRefreshCookie,
  noStore,
  proxyJson,
  sameOriginRequest,
  setRefreshCookie,
} from '../_server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) {
    return noStore(NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 }));
  }
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value || '';
  if (!refreshToken) {
    return noStore(NextResponse.json({ error: 'NO_REFRESH_SESSION' }, { status: 401 }));
  }

  try {
    const { response, payload } = await proxyJson(backendAuthUrl('refresh'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      const result = NextResponse.json(payload, { status: response.status });
      if (response.status === 401 || response.status === 403) clearRefreshCookie(result);
      return noStore(result);
    }
    const accessToken = String(payload.accessToken || '');
    const rotatedRefreshToken = String(payload.refreshToken || '');
    if (!accessToken || !rotatedRefreshToken) {
      return noStore(NextResponse.json({ error: 'INVALID_REFRESH_RESPONSE' }, { status: 502 }));
    }
    const result = NextResponse.json({ accessToken }, { status: 200 });
    setRefreshCookie(result, rotatedRefreshToken);
    return noStore(result);
  } catch {
    return noStore(NextResponse.json({ error: 'AUTH_BACKEND_UNAVAILABLE' }, { status: 502 }));
  }
}
