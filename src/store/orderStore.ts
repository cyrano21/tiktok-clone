import { create } from "zustand";
import { getProductById } from "@/services/demoShop";

export type OrderStatus = "confirmed" | "preparing" | "shipped" | "delivered";

export interface OrderItem {
  productId: string;
  title: string;
  image: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
  sellerId: string;
  shopName: string;
}

export interface Order {
  id: string;
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  buyerId: string;
}

export interface NewOrderLine {
  productId: string;
  variantLabel: string;
  quantity: number;
}

interface OrderState {
  orders: Order[];
}

interface OrderActions {
  placeOrder: (
    buyerId: string,
    lines: NewOrderLine[],
    shipping: number,
  ) => Order | null;
  advanceStatus: (orderId: string) => void;
  buyerOrders: (buyerId: string) => Order[];
  sellerOrders: (sellerId: string) => Order[];
}

type OrderStore = OrderState & OrderActions;

const STATUS_FLOW: OrderStatus[] = [
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  confirmed: "Confirmée",
  preparing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
};

let orderSeq = 1;

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],

  placeOrder: (buyerId, lines, shipping) => {
    const items: OrderItem[] = lines
      .map(l => {
        const product = getProductById(l.productId);
        if (!product) return null;
        return {
          productId: product.id,
          title: product.title,
          image: product.images[0],
          variantLabel: l.variantLabel,
          unitPrice: product.price,
          quantity: l.quantity,
          sellerId: product.sellerId,
          shopName: product.shopName,
        } as OrderItem;
      })
      .filter((x): x is OrderItem => x !== null);

    if (items.length === 0) return null;

    const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const order: Order = {
      id: `CMD-${String(orderSeq++).padStart(4, "0")}`,
      createdAt: new Date().toISOString(),
      items,
      subtotal,
      shipping,
      total: subtotal + shipping,
      status: "confirmed",
      buyerId,
    };
    set(state => ({ orders: [order, ...state.orders] }));
    return order;
  },

  advanceStatus: orderId =>
    set(state => ({
      orders: state.orders.map(o => {
        if (o.id !== orderId) return o;
        const i = STATUS_FLOW.indexOf(o.status);
        const next = STATUS_FLOW[Math.min(i + 1, STATUS_FLOW.length - 1)];
        return { ...o, status: next };
      }),
    })),

  buyerOrders: buyerId => get().orders.filter(o => o.buyerId === buyerId),

  sellerOrders: sellerId =>
    get().orders.filter(o => o.items.some(it => it.sellerId === sellerId)),
}));
