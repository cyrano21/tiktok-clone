import type { CartLine } from '@/store/cartStore';

export type OrchidyHandoffValidatedLine = {
  productId: string | null;
  catalogItemId: string;
  variantKey?: string | null;
  title: string;
  variantTitle?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  currency: string;
  availableQuantity: number;
};

export type OrchidyHandoffResponse = {
  success: true;
  checkoutUrl: string;
  expiresAt: string;
  currency: string;
  total: number | null;
  validatedLines: OrchidyHandoffValidatedLine[];
  clientPricesIgnored: true;
};

function externalIdentity(line: CartLine): string {
  return (
    line.productSnapshot.externalId ||
    line.productSnapshot.externalSlug ||
    line.productId.replace(/^orchidy:/, '')
  ).trim();
}

export async function createOrchidyCheckoutHandoff(
  lines: CartLine[],
): Promise<OrchidyHandoffResponse> {
  if (!lines.length) throw new Error('Le panier est vide.');
  if (lines.some((line) => line.productSnapshot.source !== 'orchidy')) {
    throw new Error('Le checkout partagé accepte uniquement des produits Orchidy réels.');
  }
  if (lines.some((line) => line.productSnapshot.orderable === false)) {
    throw new Error('Un produit du panier n’est plus disponible.');
  }

  const items = lines.map((line) => {
    const productId = externalIdentity(line);
    if (!productId) throw new Error('Identifiant Orchidy manquant pour un article.');
    return {
      productId,
      variantKey: line.variantId && line.variantId !== 'default' ? line.variantId : undefined,
      quantity: line.quantity,
      selectedOptions: line.selectedOptions,
    };
  });

  const response = await fetch('/api/orchidy/checkout-handoff', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      items,
      returnUrl: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success || typeof payload?.checkoutUrl !== 'string') {
    const error = new Error(payload?.error || 'Le checkout Orchidy est indisponible.');
    (error as any).code = payload?.code;
    (error as any).details = payload;
    throw error;
  }
  return payload as OrchidyHandoffResponse;
}
