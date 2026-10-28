import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { toast } from './ui';
import { useAuth } from './auth';

interface WishState { ids: string[]; toggle: (id: string) => Promise<void>; replace: (ids: string[]) => void; clear: () => void }

export const useWishlist = create<WishState>()(
  persist(
    (set, get) => ({
      ids: [],
      replace: (ids) => set({ ids }),
      clear: () => set({ ids: [] }),
      toggle: async (id) => {
        const had = get().ids.includes(id);
        const prev = get().ids;
        set({ ids: had ? prev.filter((x) => x !== id) : [...prev, id] }); // optimistic
        if (!useAuth.getState().user) return;
        try {
          const r = await api<{ productIds: string[] }>(`/wishlist/${id}`, { method: had ? 'DELETE' : 'POST' });
          set({ ids: r.productIds });
        } catch {
          set({ ids: prev });
          toast.error('Could not update your wishlist. Try again.');
        }
      },
    }),
    { name: 'sz-wishlist' },
  ),
);
