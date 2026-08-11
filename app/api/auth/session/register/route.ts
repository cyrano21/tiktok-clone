import { NextRequest, NextResponse } from 'next/server';
import {
  backendAuthUrl,
  noStore,
  proxyJson,
  readJsonBody,
  sameOriginRequest,
  setRefreshCookie,
} from '../_server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) {
    return noStore(NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 }));
  }
  try {
    const body = await readJsonBody(request);
    const { response, payload } = await proxyJson(backendAuthUrl('register'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return noStore(NextResponse.json(payload, { status: response.status }));
    }
    const refreshToken = String(payload.refreshToken || '');
    const accessToken = String(payload.accessToken || '');
    if (!refreshToken || !accessToken || !payload.user) {
      return noStore(NextResponse.json({ error: 'INVALID_AUTH_RESPONSE' }, { status: 502 }));
    }
    const result = NextResponse.json({ user: payload.user, accessToken }, { status: 201 });
    setRefreshCookie(result, refreshToken);
    return noStore(result);
  } catch (error) {
    const status = error instanceof Error && error.message === 'BODY_TOO_LARGE' ? 413 : 502;
    return noStore(NextResponse.json({ error: status === 413 ? 'BODY_TOO_LARGE' : 'AUTH_BACKEND_UNAVAILABLE' }, { status }));
  }
}
