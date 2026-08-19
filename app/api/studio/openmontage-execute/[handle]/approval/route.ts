import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  approveOpenMontageJob,
  isOpenMontageExecutorConfigured,
  type OpenMontageExecutorJob,
} from '@/server/openmontage/executor';
import { sameOriginRequest } from '../../../../auth/session/_server';
import { requireStudioBearer, verifyOpenMontageJobHandle } from '../../../_server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const approvalSchema = z
  .object({
    gate: z.string().trim().min(1).max(120),
    approved: z.boolean(),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

function publicJob(job: OpenMontageExecutorJob, handle: string) {
  const { jobId: _jobId, ...safeJob } = job;
  return { ...safeJob, handle };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  if (!sameOriginRequest(request)) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  }

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

  const parsed = approvalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_APPROVAL', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const job = await approveOpenMontageJob({
      jobId: verified.jobId,
      gate: parsed.data.gate,
      approved: parsed.data.approved,
      note: parsed.data.note,
    });
    return NextResponse.json({ ok: true, production: publicJob(job, handle) });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'OPENMONTAGE_APPROVAL_FAILED',
        message: error instanceof Error ? error.message : 'Approbation OpenMontage impossible.',
      },
      { status: 502 },
    );
  }
}
