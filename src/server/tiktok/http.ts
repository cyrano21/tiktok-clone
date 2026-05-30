/**
 * Shared HTTP helpers for the TikTok route handlers (Next.js App Router).
 * Keeps every route thin: identity resolution, JSON responses, and domain →
 * HTTP error mapping live here in one place.
 */

import { NextResponse } from 'next/server';
import { TikTokApiError } from './service';
import {
  TikTokNotConnectedError,
  TikTokRefreshExpiredError,
} from './store';

/**
 * Resolve the app user identity for a request.
 *
 * This deployment has no standalone user database. We key the connected TikTok
 * account by the bearer token when the client provides one, otherwise by a
 * single stable demo identity. This preserves the OAuth state→account mapping
 * without inventing a fake user system.
 */
export function resolveUserId(req: Request): string {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return `token:${token}`;
  }
  return 'default-user';
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function notConfigured(): NextResponse {
  return json(
    {
      error: 'TIKTOK_NOT_CONFIGURED',
      message:
        'TikTok integration is not configured. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REDIRECT_URI from an approved TikTok developer app.',
    },
    503,
  );
}

export function scopeMissing(scope: string): NextResponse {
  return json(
    {
      error: 'TIKTOK_SCOPE_MISSING',
      message: `Your connected TikTok account did not grant the "${scope}" scope. This requires an app approved for the Content Posting API. Reconnect after the scope is added.`,
      requiredScope: scope,
    },
    403,
  );
}

export function notConnected(): NextResponse {
  return json(
    { error: 'TIKTOK_NOT_CONNECTED', message: 'No TikTok account connected.' },
    409,
  );
}

/** Map domain/service errors to consistent HTTP responses. Rethrows unknowns. */
export function mapTikTokError(err: unknown): NextResponse {
  if (err instanceof TikTokNotConnectedError) {
    return json({ error: 'TIKTOK_NOT_CONNECTED', message: err.message }, 409);
  }
  if (err instanceof TikTokRefreshExpiredError) {
    return json(
      { error: 'TIKTOK_RECONNECT_REQUIRED', message: err.message },
      401,
    );
  }
  if (err instanceof TikTokApiError) {
    return json(
      { error: 'TIKTOK_API_ERROR', message: err.message, logId: err.logId },
      err.statusCode,
    );
  }
  // Unexpected → 500 with a generic message (never leak internals).
  return json(
    { error: 'INTERNAL_ERROR', message: 'Unexpected server error.' },
    500,
  );
}
