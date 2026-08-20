import { NextRequest, NextResponse } from 'next/server';
import { getOpenMontageRenderResponse, isOpenMontageExecutorConfigured } from '@/server/openmontage/executor';
import { verifyOpenMontageJobHandle, verifyOpenMontageRenderToken } from '../../../_server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORWARDED_HEADERS = [
  'accept-ranges',
  'content-disposition',
  'content-length',
  'content-range',
  'content-type',
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  if (!isOpenMontageExecutorConfigured()) {
    return NextResponse.json({ error: 'OPENMONTAGE_EXECUTOR_UNAVAILABLE' }, { status: 503 });
  }

  const token = request.nextUrl.searchParams.get('token') || '';
  const renderGrant = verifyOpenMontageRenderToken(token);
  if (!renderGrant) {
    return NextResponse.json(
      { error: 'INVALID_RENDER_TOKEN', message: 'Ce lien de rendu est invalide ou expiré.' },
      { status: 401 },
    );
  }

  const { handle } = await params;
  const verifiedHandle = verifyOpenMontageJobHandle(handle, renderGrant.userId);
  if (!verifiedHandle || verifiedHandle.jobId !== renderGrant.jobId) {
    return NextResponse.json(
      { error: 'INVALID_JOB_HANDLE', message: 'Ce rendu ne correspond pas à cette production.' },
      { status: 404 },
    );
  }

  try {
    const upstream = await getOpenMontageRenderResponse(
      renderGrant.jobId,
      request.headers.get('range'),
    );
    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Content-Type-Options', 'nosniff');

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'OPENMONTAGE_RENDER_FAILED',
        message: error instanceof Error ? error.message : 'Le rendu final est indisponible.',
      },
      { status: 502 },
    );
  }
}
