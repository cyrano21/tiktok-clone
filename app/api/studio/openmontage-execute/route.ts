import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { buildOpenMontageProductionPlan, openMontagePlanInputSchema } from '@/services/openMontagePlan';
import {
  isOpenMontageExecutorConfigured,
  submitOpenMontageJob,
  type OpenMontageExecutorJob,
} from '@/server/openmontage/executor';
import { sameOriginRequest } from '../../auth/session/_server';
import {
  canSignOpenMontageHandles,
  createOpenMontageJobHandle,
  readJsonBodyLimited,
  requireStudioBearer,
} from '../_server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 32_000;

function publicJob(job: OpenMontageExecutorJob, handle: string) {
  const { jobId: _jobId, ...safeJob } = job;
  return { ...safeJob, handle };
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  }

  const auth = await requireStudioBearer(request);
  if (!auth.ok) return auth.response;

  if (!isOpenMontageExecutorConfigured()) {
    return NextResponse.json(
      {
        error: 'OPENMONTAGE_EXECUTOR_UNAVAILABLE',
        message: 'Aucun executor OpenMontage n’est configuré pour ORKY.',
      },
      { status: 503 },
    );
  }
  if (!canSignOpenMontageHandles()) {
    return NextResponse.json(
      {
        error: 'OPENMONTAGE_HANDLE_SECRET_MISSING',
        message: 'La signature des jobs OpenMontage n’est pas configurée.',
      },
      { status: 503 },
    );
  }

  const body = await readJsonBodyLimited(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;

  try {
    const input = openMontagePlanInputSchema.parse(body.value);
    const manifest = buildOpenMontageProductionPlan(input);
    const job = await submitOpenMontageJob({ manifest });
    const handle = createOpenMontageJobHandle({ jobId: job.jobId, userId: auth.user.id });

    return NextResponse.json(
      {
        ok: true,
        production: publicJob(job, handle),
        manifest: {
          schemaVersion: manifest.schemaVersion,
          brief: manifest.brief,
          production: manifest.production,
          rights: manifest.rights,
        },
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Brief de production invalide.', issues: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: 'OPENMONTAGE_SUBMIT_FAILED',
        message: error instanceof Error ? error.message : 'Soumission OpenMontage impossible.',
      },
      { status: 502 },
    );
  }
}
