import { NextRequest, NextResponse } from 'next/server';

export const REFRESH_COOKIE = 'orky_refresh';
const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const MAX_AUTH_BODY_BYTES = 16 * 1024;

export function backendOrigin(): string {
  const raw =
    process.env.API_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://api:4000' : 'http://localhost:4000');
  return String(raw).replace(/\/$/, '').replace(/\/v1$/, '');
}

export function backendAuthUrl(path: string): string {
  return `${backendOrigin()}/v1/auth/${path.replace(/^\//, '')}`;
}

export function sameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_AUTH_BODY_BYTES) {
    throw new Error('BODY_TOO_LARGE');
  }
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_AUTH_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
  return text ? JSON.parse(text) : {};
}

export function setRefreshCookie(response: NextResponse, refreshToken: string) {
  response.cookies.set({
    name: REFRESH_COOKIE,
    value: refreshToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearRefreshCookie(response: NextResponse) {
  response.cookies.set({
    name: REFRESH_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function proxyJson(
  url: string,
  init: RequestInit,
): Promise<{ response: Response; payload: any }> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, private');
  response.headers.set('Pragma', 'no-cache');
  return response;
}
