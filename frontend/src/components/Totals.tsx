import { money } from '../lib/format';
import type { PricedCart } from '../types';

export function Totals({ d, estimate }: { d: PricedCart; estimate?: boolean }) {
  const row = (k: string, v: string, cls = '') => <div className={`flex justify-between ${cls}`}><dt className="text-muted">{k}</dt><dd>{v}</dd></div>;
  return (
    <dl className="space-y-2 text-sm">
      {row('Subtotal', money(d.subtotal))}
      {d.discount > 0 && row(`Discount${d.coupon ? ` (${d.coupon.code})` : ''}`, `−${money(d.discount)}`, 'text-ok')}
      {row(estimate ? 'Shipping (estimate)' : 'Shipping', d.shipping === 0 ? 'Free' : money(d.shipping))}
      {row(estimate ? 'Tax (estimate)' : 'Tax', money(d.tax))}
      <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd>{money(d.total)}</dd></div>
    </dl>
  );
}
