/**
 * Viral-sourcing request id (orchidy-pro) attached to ORKY checkout handoff
 * lines. The Marketplace keeps it on the order and echoes it back through the
 * "Order paid" webhook (`items[].requestId`) so orchidy-pro can attribute a
 * sale to the Trend Radar request that produced the product.
 *
 * Lexical contract identical to the generated-video import route
 * (`app/api/trends/generated-video/import/route.ts`): a short alphanumeric id.
 * The Pro receiver tolerates invalid ids by skipping the line instead of
 * failing the whole order, so ORKY never blocks a real purchase on
 * attribution metadata: invalid values are dropped, never sent.
 */
export const HANDOFF_REQUEST_ID_RE = /^[A-Za-z0-9]{10,40}$/;

/** Returns the trimmed id when it matches the contract, otherwise undefined. */
export function sanitizeHandoffRequestId(value: unknown): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return undefined;
  return HANDOFF_REQUEST_ID_RE.test(raw) ? raw : undefined;
}
