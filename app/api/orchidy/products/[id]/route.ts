import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ProductResponse = Record<string, unknown>;

function resolveOrchidyBaseUrl() {
  const raw =
    process.env.ORCHIDY_API_BASE_URL ||
    process.env.NEXT_PUBLIC_ORCHIDY_BASE_URL ||
    'https://orchidy.fr';
  return raw.replace(/\/$/, '');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = decodeURIComponent(String(params.id || '').trim());
  if (!id) {
    return NextResponse.json(
      { success: false, source: 'orchidy', error: 'ORCHIDY_PRODUCT_ID_REQUIRED' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${resolveOrchidyBaseUrl()}/api/products/${encodeURIComponent(id)}`,
      { headers: { accept: 'application/json' }, cache: 'no-store' },
    );
    const payload = await response.json().catch(() => null) as ProductResponse | null;
    if (!response.ok || !payload) {
      return NextResponse.json(
        { success: false, source: 'orchidy', error: 'ORCHIDY_PRODUCT_UNAVAILABLE' },
        { status: 502 },
      );
    }
    return NextResponse.json({
      success: true,
      source: 'orchidy',
      product: (payload as any).product ?? payload,
    });
  } catch {
    return NextResponse.json(
      { success: false, source: 'orchidy', error: 'ORCHIDY_PRODUCT_UNAVAILABLE' },
      { status: 502 },
    );
  }
}
