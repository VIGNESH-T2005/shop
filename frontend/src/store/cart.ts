import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '../types';

interface CartState {
  items: CartItem[];
  add: (item: CartItem) => void;
  setQty: (productId: string, sku: string, qty: number) => void;
  remove: (productId: string, sku: string) => void;
  replace: (items: CartItem[]) => void;
  clear: () => void;
}
const same = (a: CartItem, productId: string, sku: string) => a.productId === productId && a.sku === sku;

/** Guests: this localStorage copy is the cart. Signed-in users: it mirrors the server cart (see useSessionSync). */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((s) => {
          const found = s.items.find((i) => same(i, item.productId, item.sku));
          return found
            ? { items: s.items.map((i) => (i === found ? { ...i, qty: Math.min(99, i.qty + item.qty) } : i)) }
            : { items: [...s.items, item] };
        }),
      setQty: (productId, sku, qty) =>
        set((s) => ({ items: qty <= 0 ? s.items.filter((i) => !same(i, productId, sku)) : s.items.map((i) => (same(i, productId, sku) ? { ...i, qty: Math.min(99, qty) } : i)) })),
      remove: (productId, sku) => set((s) => ({ items: s.items.filter((i) => !same(i, productId, sku)) })),
      replace: (items) => set({ items }),
      clear: () => set({ items: [] }),
    }),
    { name: 'sz-cart' },
  ),
);
