import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Address } from '../types';

interface CheckoutState {
  email: string;
  address: Address | null;
  method: 'standard' | 'express';
  coupon: string;
  set: (p: Partial<Omit<CheckoutState, 'set' | 'reset'>>) => void;
  reset: () => void;
}
const initial = { email: '', address: null, method: 'standard' as const, coupon: '' };
/** Kept in sessionStorage only: it is cleared when the tab closes, and holds no payment data. */
export const useCheckout = create<CheckoutState>()(
  persist((set) => ({ ...initial, set: (p) => set(p), reset: () => set(initial) }), { name: 'sz-checkout', storage: createJSONStorage(() => sessionStorage) }),
);
