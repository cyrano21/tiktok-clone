import { NextRequest, NextResponse } from 'next/server';
import {
  getOpenMontageJob,
  isOpenMontageExecutorConfigured,
  type OpenMontageExecutorJob,
} from '@/server/openmontage/executor';
import {
  createOpenMontageRenderToken,
  requireStudioBearer,
  verifyOpenMontageJobHandle,
} from '../../_server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publicJob(job: OpenMontageExecutorJob, handle: string, renderDownloadUrl?: string) {
  const { jobId: _jobId, render, ...safeJob } = job;
  return {
    ...safeJob,
    ...(render
      ? {
          render: {
            ...render,
            // Never expose the executor's internal hostname or bearer token.
            // The URL below is an ORKY same-origin proxy protected by a short-
            // lived signed render grant.
            downloadUrl:
              renderDownloadUrl ||
              `/api/studio/openmontage-execute/${encodeURIComponent(handle)}/render-link`,
          },
        }
      : {}),
    handle,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const auth = await requireStudioBearer(request);
  if (!auth.ok) return auth.response;

  if (!isOpenMontageExecutorConfigured()) {
    return NextResponse.json(
      { error: 'OPENMONTAGE_EXECUTOR_UNAVAILABLE' },
      { status: 503 },
    );
  }

  const { handle } = await params;
  const verified = verifyOpenMontageJobHandle(handle, auth.user.id);
  if (!verified) {
    return NextResponse.json(
      { error: 'INVALID_JOB_HANDLE', message: 'Ce job est invalide, expiré ou ne vous appartient pas.' },
      { status: 404 },
    );
  }

  try {
    const job = await getOpenMontageJob(verified.jobId);
    let renderDownloadUrl: string | undefined;
    if (job.status === 'completed' && job.render) {
      const token = createOpenMontageRenderToken({
        jobId: verified.jobId,
        userId: auth.user.id,
      });
      const url = new URL(
        `/api/studio/openmontage-execute/${encodeURIComponent(handle)}/render`,
        request.nextUrl.origin,
      );
      url.searchParams.set('token', token);
      renderDownloadUrl = url.toString();
    }

    return NextResponse.json({
      ok: true,
      production: publicJob(job, handle, renderDownloadUrl),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'OPENMONTAGE_STATUS_FAILED',
        message: error instanceof Error ? error.message : 'Lecture du job OpenMontage impossible.',
      },
      { status: 502 },
    );
  }
}
