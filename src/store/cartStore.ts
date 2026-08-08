import { create } from "zustand";
import { Product, getProductById } from "@/services/demoShop";
import { CommerceProduct, getCachedCommerceProduct } from "@/services/orchidyProducts";

export interface CartLine {
  key: string; // productId + variantId
  productId: string;
  variantId: string;
  variantLabel: string;
  selectedOptions?: Record<string, string>;
  quantity: number;
  productSnapshot: CommerceProduct;
}

interface CartState {
  lines: CartLine[];
  lastOrderTotal: number | null;
}

interface CartActions {
  addToCart: (product: Product | CommerceProduct, variantId: string, quantity?: number) => void;
  removeLine: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  checkout: () => number;
  totalItems: () => number;
  subtotal: () => number;
  shippingTotal: () => number;
  total: () => number;
}

type CartStore = CartState & CartActions;

const FLAT_SHIPPING = 3.9;

function resolveProduct(line: CartLine): CommerceProduct | Product | undefined {
  return getCachedCommerceProduct(line.productId) || getProductById(line.productId) || line.productSnapshot;
}

export const useCartStore = create<CartStore>((set, get) => ({
  lines: [],
  lastOrderTotal: null,

  addToCart: (product, variantId, quantity = 1) => {
    const variant = product.variants.find(v => v.id === variantId) ?? product.variants[0] ?? { id: 'default', label: 'Standard' };
    const key = `${product.id}__${variant.id}`;
    const selectedOptions = 'selectedOptions' in variant ? variant.selectedOptions : undefined;
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

  clear: () => set({ lines: [] }),

  checkout: () => {
    const total = get().total();
    set({ lines: [], lastOrderTotal: total });
    return total;
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
}));
