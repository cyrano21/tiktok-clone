import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { backendOrigin, noStore } from '../auth/session/_server';

const JOB_HANDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StudioUser = {
  id: string;
  username?: string;
  role?: string;
};

type StudioAuthSuccess = {
  ok: true;
  authorization: string;
  user: StudioUser;
};

type StudioAuthFailure = {
  ok: false;
  response: NextResponse;
};

export type StudioAuthResult = StudioAuthSuccess | StudioAuthFailure;

function handleSecret(): string | null {
  return (
    process.env.OPENMONTAGE_JOB_HANDLE_SECRET?.trim() ||
    process.env.OPENMONTAGE_EXECUTOR_TOKEN?.trim() ||
    null
  );
}

function signPayload(payload: string): string {
  const secret = handleSecret();
  if (!secret) throw new Error('OPENMONTAGE_JOB_HANDLE_SECRET is not configured.');
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function canSignOpenMontageHandles(): boolean {
  return Boolean(handleSecret());
}

export async function requireStudioBearer(request: NextRequest): Promise<StudioAuthResult> {
  const authorization = request.headers.get('authorization')?.trim() || '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return {
      ok: false,
      response: noStore(
        NextResponse.json(
          { error: 'AUTH_REQUIRED', message: 'Une session ORKY authentifiée est requise.' },
          { status: 401 },
        ),
      ),
    };
  }

  try {
    const response = await fetch(`${backendOrigin()}/v1/auth/me`, {
      method: 'GET',
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.user?.id) {
      return {
        ok: false,
        response: noStore(
          NextResponse.json(
            { error: 'AUTH_INVALID', message: 'La session ORKY n’est plus valide.' },
            { status: response.status === 401 || response.status === 403 ? response.status : 401 },
          ),
        ),
      };
    }

    return {
      ok: true,
      authorization,
      user: {
        id: String(payload.user.id),
        username: payload.user.username ? String(payload.user.username) : undefined,
        role: payload.user.role ? String(payload.user.role) : undefined,
      },
    };
  } catch {
    return {
      ok: false,
      response: noStore(
        NextResponse.json(
          { error: 'AUTH_BACKEND_UNAVAILABLE', message: 'Le service de session ORKY est indisponible.' },
          { status: 502 },
        ),
      ),
    };
  }
}

export function createOpenMontageJobHandle(params: { jobId: string; userId: string }): string {
  const payload = Buffer.from(
    JSON.stringify({
      j: params.jobId,
      u: params.userId,
      exp: Date.now() + JOB_HANDLE_TTL_MS,
    }),
    'utf8',
  ).toString('base64url');
  return `${payload}.${signPayload(payload)}`;
}

export function verifyOpenMontageJobHandle(
  handle: string,
  expectedUserId: string,
): { jobId: string } | null {
  if (!handle || handle.length > 1200) return null;
  const [payload, signature, extra] = handle.split('.');
  if (!payload || !signature || extra) return null;

  let expectedSignature: string;
  try {
    expectedSignature = signPayload(payload);
  } catch {
    return null;
  }

  const provided = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      j?: unknown;
      u?: unknown;
      exp?: unknown;
    };
    if (typeof decoded.j !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/.test(decoded.j)) return null;
    if (decoded.u !== expectedUserId) return null;
    if (typeof decoded.exp !== 'number' || !Number.isFinite(decoded.exp) || decoded.exp < Date.now()) return null;
    return { jobId: decoded.j };
  } catch {
    return null;
  }
}
