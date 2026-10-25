import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../lib/secureStorage';
import type { CartLine } from './cartStore';

export type PaymentMethodType = 'card' | 'wallet' | 'bank_transfer';

export type PaymentRecord = {
  type: PaymentMethodType;
  status: 'paid' | 'pending' | 'failed';
  brand?: string;
  last4?: string;
  reference: string;
  failure_message?: string;
};

export type OrderItem = {
  id: string;
  product_id: string;
  seller_id: string;
  name: string;
  unit_minor: number;
  quantity: number;
  emoji: string;
  image_url?: string;
};

export type Order = {
  id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
  total_minor: number;
  currency: string;
  status: 'paid' | 'pending_payment' | 'payment_failed' | 'refunded';
  items: OrderItem[];
  shipping: { name: string; address: string; phone: string };
  payment: PaymentRecord;
  created_at: string;
};

type CreateOrderInput = {
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  shipping: { name: string; address: string; phone: string };
  items: CartLine[];
  paymentMethod: PaymentMethodType;
  cardLast4?: string;
  cardBrand?: string;
  outcome?: Order['status'];
  failureMessage?: string;
};

interface OrdersState {
  orders: Order[];
  createOrder: (input: CreateOrderInput) => Order;
  markPaid: (orderId: string) => void;
  getOrder: (orderId: string) => Order | undefined;
}

function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],

      createOrder: (input) => {
        const total = input.items.reduce((sum, i) => sum + i.unit_minor * i.quantity, 0);
        const status =
          input.outcome ??
          (input.paymentMethod === 'bank_transfer' ? 'pending_payment' : 'paid');
        const order: Order = {
          id: newId('ord'),
          buyer_id: input.buyerId,
          buyer_name: input.buyerName,
          buyer_email: input.buyerEmail,
          total_minor: total,
          currency: 'NGN',
          status,
          items: input.items.map((line, index) => ({
            id: `${index}-${line.product_id}`,
            product_id: line.product_id,
            seller_id: 'usr_studio',
            name: line.name,
            unit_minor: line.unit_minor,
            quantity: line.quantity,
            emoji: line.emoji,
            image_url: line.image_url,
          })),
          shipping: input.shipping,
          payment: {
            type: input.paymentMethod,
            status: status === 'paid' ? 'paid' : status === 'pending_payment' ? 'pending' : 'failed',
            brand: input.cardBrand,
            last4: input.cardLast4,
            reference: newId('pi'),
            failure_message: input.failureMessage,
          },
          created_at: new Date().toISOString(),
        };
        set((state) => ({ orders: [order, ...state.orders] }));
        return order;
      },

      markPaid: (orderId) =>
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  status: 'paid',
                  payment: { ...order.payment, status: 'paid' },
                }
              : order,
          ),
        })),

      getOrder: (orderId) => get().orders.find((o) => o.id === orderId),
    }),
    {
      name: 'still-orders',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ orders: state.orders }),
    },
  ),
);
