import { NextRequest, NextResponse } from 'next/server';
import { getOpenMontageJob, isOpenMontageExecutorConfigured } from '@/server/openmontage/executor';
import {
  createOpenMontageRenderToken,
  requireStudioBearer,
  verifyOpenMontageJobHandle,
} from '../../../_server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const auth = await requireStudioBearer(request);
  if (!auth.ok) return auth.response;

  if (!isOpenMontageExecutorConfigured()) {
    return NextResponse.json({ error: 'OPENMONTAGE_EXECUTOR_UNAVAILABLE' }, { status: 503 });
  }

  const { handle } = await params;
  const verified = verifyOpenMontageJobHandle(handle, auth.user.id);
  if (!verified) {
    return NextResponse.json(
      { error: 'INVALID_JOB_HANDLE', message: 'Ce rendu est invalide, expiré ou ne vous appartient pas.' },
      { status: 404 },
    );
  }

  try {
    const job = await getOpenMontageJob(verified.jobId);
    if (job.status !== 'completed' || !job.render) {
      return NextResponse.json(
        { error: 'RENDER_NOT_READY', message: 'Le rendu final n’est pas encore disponible.' },
        { status: 409 },
      );
    }

    const token = createOpenMontageRenderToken({ jobId: verified.jobId, userId: auth.user.id });
    const url = new URL(
      `/api/studio/openmontage-execute/${encodeURIComponent(handle)}/render`,
      request.nextUrl.origin,
    );
    url.searchParams.set('token', token);

    return NextResponse.json(
      {
        ok: true,
        url: url.toString(),
        expiresInSeconds: 600,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: 'OPENMONTAGE_RENDER_LINK_FAILED',
        message: error instanceof Error ? error.message : 'Impossible de préparer le lien de rendu.',
      },
      { status: 502 },
    );
  }
}
