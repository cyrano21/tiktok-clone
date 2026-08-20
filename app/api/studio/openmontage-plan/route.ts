import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  buildOpenMontageProductionPlan,
  openMontagePlanInputSchema,
} from '@/services/openMontagePlan';
import { readJsonBodyLimited } from '../_server';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 32_000;

export async function POST(request: NextRequest) {
  const body = await readJsonBodyLimited(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;

  try {
    const input = openMontagePlanInputSchema.parse(body.value);
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
