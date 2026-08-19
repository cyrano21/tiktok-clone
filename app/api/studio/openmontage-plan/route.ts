import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  buildOpenMontageProductionPlan,
  openMontagePlanInputSchema,
} from '@/services/openMontagePlan';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 32_000;

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload trop volumineux.' }, { status: 413 });
  }

  try {
    const body = await request.json();
    const input = openMontagePlanInputSchema.parse(body);
    const plan = buildOpenMontageProductionPlan(input);

    return NextResponse.json({
      ok: true,
      plan,
      execution: {
        automatic: false,
        reason:
          'ORKY génère le contrat de production. OpenMontage reste un workspace externe afin de préserver une frontière claire de licence et de déploiement.',
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Brief de production invalide.', issues: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: 'Impossible de préparer le plan de production.' }, { status: 500 });
  }
}
