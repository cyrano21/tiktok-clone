import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Product, getProductById } from '@/services/demoShop';
import { CommerceProduct, CommerceVariant, getCachedCommerceProduct } from '@/services/orchidyProducts';

export interface CartLine {
  key: string; // productId + variantId
  productId: string;
  variantId: string;
  variantLabel: string;
  selectedOptions?: Record<string, string>;
  quantity: number;
  productSnapshot: CommerceProduct;
}

export interface PendingHandoffLine {
  key: string;
  quantity: number;
}

export interface PendingHandoff {
  lines: PendingHandoffLine[];
  createdAt: string;
}

interface CartState {
  lines: CartLine[];
  lastOrderTotal: number | null;
  pendingHandoffs: Record<string, PendingHandoff>;
}

interface CartActions {
  addToCart: (product: Product | CommerceProduct, variantId: string, quantity?: number) => void;
  removeLine: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  /** Legacy helper retained for compatibility. It never mutates the cart. */
  checkout: () => number;
  markHandoff: (handoffId: string, lines: CartLine[]) => void;
  completeHandoff: (handoffId: string) => boolean;
  cancelHandoff: (handoffId: string) => void;
  totalItems: () => number;
  subtotal: () => number;
  shippingTotal: () => number;
  total: () => number;
}

type CartStore = CartState & CartActions;

const FLAT_SHIPPING = 3.9;
const MAX_HANDOFF_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function resolveProduct(line: CartLine): CommerceProduct | Product | undefined {
  return getCachedCommerceProduct(line.productId) || getProductById(line.productId) || line.productSnapshot;
}

function cleanPendingHandoffs(input: Record<string, PendingHandoff>): Record<string, PendingHandoff> {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(input).filter(([, handoff]) => {
      const createdAt = new Date(handoff.createdAt).getTime();
      return Number.isFinite(createdAt) && now - createdAt <= MAX_HANDOFF_AGE_MS;
    }),
  );
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      lines: [],
      lastOrderTotal: null,
      pendingHandoffs: {},

      addToCart: (product, variantId, quantity = 1) => {
        const variant = product.variants.find(v => v.id === variantId) ?? product.variants[0] ?? { id: 'default', label: 'Standard' };
        const key = `${product.id}__${variant.id}`;
        const selectedOptions: Record<string, string> | undefined =
          (variant as CommerceVariant).selectedOptions;
        set(state => {
          const existing = state.lines.find(l => l.key === key);
          if (existing) {
            return {
              lines: state.lines.map(l =>
                l.key === key
                  ? {
                      ...l,
                      quantity: Math.min(25, l.quantity + quantity),
                      productSnapshot: product as CommerceProduct,
                      selectedOptions,
                    }
                  : l,
              ),
            };
          }
          return {
            lines: [
              ...state.lines,
              {
                key,
                productId: product.id,
                variantId: variant.id,
                variantLabel: variant.label,
                selectedOptions,
                quantity: Math.min(25, Math.max(1, quantity)),
                productSnapshot: product as CommerceProduct,
              },
            ],
          };
        });
      },

      removeLine: key =>
        set(state => ({ lines: state.lines.filter(l => l.key !== key) })),

      setQuantity: (key, quantity) =>
        set(state => ({
          lines:
            quantity <= 0
              ? state.lines.filter(l => l.key !== key)
              : state.lines.map(l => (l.key === key ? { ...l, quantity: Math.min(25, quantity) } : l)),
        })),

      clear: () => set({ lines: [], pendingHandoffs: {} }),

      // A local UI helper must never be able to manufacture a successful order.
      // Real checkout completion is driven only by a verified Orchidy receipt.
      checkout: () => get().total(),

      markHandoff: (handoffId, handoffLines) => {
        const normalizedId = String(handoffId || '').trim();
        if (!normalizedId || handoffLines.length === 0) return;
        set(state => ({
          pendingHandoffs: {
            ...cleanPendingHandoffs(state.pendingHandoffs),
            [normalizedId]: {
              lines: handoffLines.map((line) => ({ key: line.key, quantity: line.quantity })),
              createdAt: new Date().toISOString(),
            },
          },
        }));
      },

      completeHandoff: (handoffId) => {
        const pending = get().pendingHandoffs[handoffId];
        if (!pending) return false;
        const purchasedByKey = new Map(pending.lines.map((line) => [line.key, line.quantity]));
        set(state => {
          const nextHandoffs = { ...state.pendingHandoffs };
          delete nextHandoffs[handoffId];
          return {
            lines: state.lines.flatMap((line) => {
              const purchased = purchasedByKey.get(line.key) ?? 0;
              if (purchased <= 0) return [line];
              const remaining = line.quantity - purchased;
              return remaining > 0 ? [{ ...line, quantity: remaining }] : [];
            }),
            pendingHandoffs: nextHandoffs,
          };
        });
        return true;
      },

      cancelHandoff: (handoffId) => {
        set(state => {
          if (!state.pendingHandoffs[handoffId]) return state;
          const nextHandoffs = { ...state.pendingHandoffs };
          delete nextHandoffs[handoffId];
          return { pendingHandoffs: nextHandoffs };
        });
      },

      totalItems: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),

      subtotal: () =>
        get().lines.reduce((sum, l) => {
          const p = resolveProduct(l);
          return sum + (p ? p.price * l.quantity : 0);
        }, 0),

      shippingTotal: () => {
        const lines = get().lines;
        if (lines.length === 0) return 0;
        const allFree = lines.every(l => resolveProduct(l)?.freeShipping);
        return allFree ? 0 : FLAT_SHIPPING;
      },

      total: () => get().subtotal() + get().shippingTotal(),
    }),
    {
      name: 'orky-cart-v2',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lines: state.lines,
        lastOrderTotal: state.lastOrderTotal,
        pendingHandoffs: cleanPendingHandoffs(state.pendingHandoffs),
      }),
    },
  ),
);
