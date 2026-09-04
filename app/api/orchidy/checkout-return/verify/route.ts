import { NextRequest, NextResponse } from 'next/server';
import { verifyOrchidyReceipt } from '@/lib/orchidyCheckoutCrypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const receipt = request.nextUrl.searchParams.get('receipt') || '';
    if (!receipt || receipt.length > 4096) {
      return NextResponse.json({ success: false, error: 'Receipt required' }, { status: 400 });
    }
    const payload = verifyOrchidyReceipt(receipt);
    return NextResponse.json(
      {
        success: true,
        verified: true,
        status: payload.status,
        handoffId: payload.handoffId,
        checkoutId: payload.checkoutId,
      },
      {
        headers: {
          'Cache-Control': 'no-store, private',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch (error) {
    console.warn('[orchidy-return-receipt] rejected', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, verified: false, error: 'Invalid or expired Orchidy receipt' },
      { status: 401, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }
}
