import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { useCart } from '../store/cart';
import { toast } from '../store/ui';
import type { PricedCart } from '../types';

/** Prices the cart on the server. The returned totals are the only ones the UI shows. */
export function usePricedCart(opts: { couponCode?: string; shippingMethod?: 'standard' | 'express' } = {}) {
  const items = useCart((s) => s.items);
  const key = JSON.stringify(items);
  const q = useQuery({
    queryKey: ['priced-cart', key, opts.couponCode ?? '', opts.shippingMethod ?? 'standard'],
    queryFn: () => api<PricedCart>('/cart/price', { method: 'POST', body: { items, couponCode: opts.couponCode || undefined, shippingMethod: opts.shippingMethod ?? 'standard' } }),
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
  });

  // Reconcile the local cart with what the server says is actually available.
  useEffect(() => {
    const d = q.data;
    if (!d || q.isPlaceholderData || !d.issues.length) return;
    const { remove, setQty } = useCart.getState();
    for (const i of d.issues) {
      if (i.type === 'stock_adjusted') {
        const line = d.lines.find((l) => l.productId === i.productId && l.sku === i.sku);
        if (line) setQty(i.productId, i.sku, line.qty);
      } else remove(i.productId, i.sku);
      toast.info(i.message);
    }
  }, [q.data, q.isPlaceholderData]);

  return q;
}
