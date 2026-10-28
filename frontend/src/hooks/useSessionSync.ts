import { useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useCart } from '../store/cart';
import { useWishlist } from '../store/wishlist';
import type { CartItem } from '../types';

let ready = false;

/** On sign-in: merge the guest cart and wishlist into the account. While signed in: keep the DB cart in sync. */
export function useSessionSync() {
  const userId = useAuth((s) => s.user?.id);

  useEffect(() => {
    ready = false;
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const cart = await api<{ items: CartItem[] }>('/cart/merge', { method: 'POST', body: { items: useCart.getState().items } });
        const wish = await api<{ productIds: string[] }>('/wishlist/merge', { method: 'POST', body: { productIds: useWishlist.getState().ids } });
        if (cancelled) return;
        useCart.getState().replace(cart.items);
        useWishlist.getState().replace(wish.productIds);
        ready = true;
      } catch {
        /* the guest copy stays; it merges on the next sign-in */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let t: ReturnType<typeof setTimeout>;
    const unsub = useCart.subscribe((s) => {
      if (!ready) return;
      clearTimeout(t);
      t = setTimeout(() => api('/cart', { method: 'PUT', body: { items: s.items } }).catch(() => undefined), 600);
    });
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, [userId]);
}
