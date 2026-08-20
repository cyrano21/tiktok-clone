import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { backendOrigin, noStore } from '../auth/session/_server';

const JOB_HANDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RENDER_TOKEN_TTL_MS = 10 * 60 * 1000;

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

export type LimitedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse };

/**
 * Read a JSON request body while enforcing the byte limit on the stream itself.
 * Content-Length is only an early rejection hint; chunked requests cannot bypass
 * the limit because reading stops as soon as the accumulated bytes exceed it.
 */
export async function readJsonBodyLimited(
  request: NextRequest,
  maxBytes: number,
): Promise<LimitedJsonResult> {
  const declaredRaw = request.headers.get('content-length');
  if (declaredRaw) {
    const declared = Number(declaredRaw);
    if (!Number.isFinite(declared) || declared < 0) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'INVALID_CONTENT_LENGTH' }, { status: 400 }),
      };
    }
    if (declared > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Payload trop volumineux.' }, { status: 413 }),
      };
    }
  }

  if (!request.body) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Corps JSON requis.' }, { status: 400 }),
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('payload_too_large').catch(() => undefined);
        return {
          ok: false,
          response: NextResponse.json({ error: 'Payload trop volumineux.' }, { status: 413 }),
        };
      }
      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Lecture du corps impossible.' }, { status: 400 }),
    };
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(combined);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'JSON invalide.' }, { status: 400 }),
    };
  }
}

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

function verifySignedPayload(token: string): Record<string, unknown> | null {
  if (!token || token.length > 1600) return null;
  const [payload, signature, extra] = token.split('.');
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
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return null;
    return decoded as Record<string, unknown>;
  } catch {
    return null;
  }
}

function createSignedPayload(value: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  return `${payload}.${signPayload(payload)}`;
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
  return createSignedPayload({
    typ: 'job',
    j: params.jobId,
    u: params.userId,
    exp: Date.now() + JOB_HANDLE_TTL_MS,
  });
}

export function verifyOpenMontageJobHandle(
  handle: string,
  expectedUserId: string,
): { jobId: string } | null {
  const decoded = verifySignedPayload(handle);
  if (!decoded || decoded.typ !== 'job') return null;
  if (typeof decoded.j !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/.test(decoded.j)) return null;
  if (decoded.u !== expectedUserId) return null;
  if (typeof decoded.exp !== 'number' || !Number.isFinite(decoded.exp) || decoded.exp < Date.now()) return null;
  return { jobId: decoded.j };
}

export function createOpenMontageRenderToken(params: { jobId: string; userId: string }): string {
  return createSignedPayload({
    typ: 'render',
    j: params.jobId,
    u: params.userId,
    exp: Date.now() + RENDER_TOKEN_TTL_MS,
  });
}

export function verifyOpenMontageRenderToken(
  token: string,
): { jobId: string; userId: string } | null {
  const decoded = verifySignedPayload(token);
  if (!decoded || decoded.typ !== 'render') return null;
  if (typeof decoded.j !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/.test(decoded.j)) return null;
  if (typeof decoded.u !== 'string' || decoded.u.length < 1 || decoded.u.length > 200) return null;
  if (typeof decoded.exp !== 'number' || !Number.isFinite(decoded.exp) || decoded.exp < Date.now()) return null;
  return { jobId: decoded.j, userId: decoded.u };
}
