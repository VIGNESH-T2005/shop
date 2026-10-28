const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const money = (cents: number) => usd.format(cents / 100);
export const date = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
export const discountPct = (price: number, compare?: number) => (compare && compare > price ? Math.round((1 - price / compare) * 100) : 0);
export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const statusLabel: Record<string, string> = {
  pending: 'Awaiting payment', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
  paid: 'Paid', refunded: 'Refunded', partially_refunded: 'Partly refunded', failed: 'Failed',
};
