import { create } from "zustand";
import { Product, getProductById } from "@/services/demoShop";

export interface CartLine {
  key: string; // productId + variantId
  productId: string;
  variantId: string;
  variantLabel: string;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  lastOrderTotal: number | null;
}

interface CartActions {
  addToCart: (product: Product, variantId: string, quantity?: number) => void;
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

export const useCartStore = create<CartStore>((set, get) => ({
  lines: [],
  lastOrderTotal: null,

  addToCart: (product, variantId, quantity = 1) => {
    const variant =
      product.variants.find(v => v.id === variantId) ?? product.variants[0];
    const key = `${product.id}__${variant.id}`;
    set(state => {
      const existing = state.lines.find(l => l.key === key);
      if (existing) {
        return {
          lines: state.lines.map(l =>
            l.key === key ? { ...l, quantity: l.quantity + quantity } : l,
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
            quantity,
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
          : state.lines.map(l => (l.key === key ? { ...l, quantity } : l)),
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
      const p = getProductById(l.productId);
      return sum + (p ? p.price * l.quantity : 0);
    }, 0),

  shippingTotal: () => {
    const lines = get().lines;
    if (lines.length === 0) return 0;
    // Free shipping if every product in cart offers free shipping
    const allFree = lines.every(l => getProductById(l.productId)?.freeShipping);
    return allFree ? 0 : FLAT_SHIPPING;
  },

  total: () => get().subtotal() + get().shippingTotal(),
}));
