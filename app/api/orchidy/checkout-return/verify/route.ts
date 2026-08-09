import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReceiptPayload = {
  v: 1;
  handoffId: string;
  checkoutId: string;
  status: 'paid' | 'cancelled';
  iat: number;
  exp: number;
};

function secret(): string {
  const value = String(process.env.ORKY_CHECKOUT_HANDOFF_SECRET || '').trim();
  if (!value) throw new Error('ORKY_CHECKOUT_HANDOFF_SECRET is not configured');
  if (process.env.NODE_ENV === 'production' && value.length < 32) {
    throw new Error('ORKY_CHECKOUT_HANDOFF_SECRET is too weak');
  }
  return value;
}

function safeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function verifyReceipt(raw: string): ReceiptPayload {
  const [version, encoded, signature, extra] = String(raw || '').trim().split('.');
  if (version !== 'r1' || !encoded || !signature || extra) throw new Error('INVALID_RECEIPT');
  const expected = crypto
    .createHmac('sha256', secret())
    .update(`orky-return.${encoded}`, 'utf8')
    .digest('hex');
  if (!safeHexEqual(signature, expected)) throw new Error('INVALID_RECEIPT_SIGNATURE');

  let payload: ReceiptPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ReceiptPayload;
  } catch {
    throw new Error('INVALID_RECEIPT_PAYLOAD');
  }

  const now = Math.floor(Date.now() / 1_000);
  if (
    payload?.v !== 1 ||
    !/^[a-f\d]{24}$/i.test(String(payload.handoffId || '')) ||
    !/^[A-Za-z0-9:_-]{12,180}$/.test(String(payload.checkoutId || '')) ||
    !['paid', 'cancelled'].includes(payload.status) ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= now ||
    payload.iat > now + 300
  ) {
    throw new Error('INVALID_RECEIPT_PAYLOAD');
  }
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const receipt = request.nextUrl.searchParams.get('receipt') || '';
    if (!receipt || receipt.length > 4096) {
      return NextResponse.json({ success: false, error: 'Receipt required' }, { status: 400 });
    }
    const payload = verifyReceipt(receipt);
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
