import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ErrorState } from '../components/StateViews';
import { Skeleton } from '../components/Skeleton';
import { api } from '../lib/api';
import { date, money, statusLabel } from '../lib/format';
import { toast } from '../store/ui';
import type { Order } from '../types';

const lines = (o: Order) => (
  <ul className="divide-y divide-line">
    {o.items.map((i) => (
      <li key={i.sku + i.product} className="flex gap-4 py-4 text-sm">
        {i.image && <img src={i.image} alt="" className="h-16 w-14 rounded-lg object-cover no-print" />}
        <div className="flex-1"><p className="font-semibold">{i.title}</p><p className="text-muted">{i.variantLabel} × {i.qty} at {money(i.unitPrice)}</p></div>
        <p className="font-semibold">{money(i.unitPrice * i.qty)}</p>
      </li>
    ))}
  </ul>
);
const totals = (o: Order) => (
  <dl className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
    {[['Subtotal', money(o.subtotal)], ...(o.discount ? [[`Discount${o.couponCode ? ` (${o.couponCode})` : ''}`, `−${money(o.discount)}`]] : []), ['Shipping', o.shipping ? money(o.shipping) : 'Free'], ['Tax', money(o.tax)]].map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}
    <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd>{money(o.total)}</dd></div>
    {o.refundedCents > 0 && <div className="flex justify-between text-ok"><dt>Refunded</dt><dd>{money(o.refundedCents)}</dd></div>}
  </dl>
);

export default function Orders({ mode }: { mode: 'detail' | 'invoice' }) {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => api<Order>(`/orders/${id}`) });
  const cancel = useMutation({
    mutationFn: () => api(`/orders/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => { toast.success('Order cancelled. Your refund is on its way.'); qc.invalidateQueries({ queryKey: ['order', id] }); qc.invalidateQueries({ queryKey: ['my-orders'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (q.isLoading) return <div className="container-x max-w-3xl py-10"><Skeleton className="h-96" /></div>;
  if (q.isError || !q.data) return <div className="container-x py-20"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const o = q.data;
  const a = o.shippingAddress;
  const addr = <p className="text-sm text-muted">{a.fullName}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} {a.postalCode}, {a.country}</p>;

  if (mode === 'invoice') {
    return (
      <div className="container-x max-w-3xl py-10">
        <div className="no-print mb-6 flex justify-between"><Link to={`/orders/${id}`} className="btn-ghost">Back to order</Link><button className="btn-primary" onClick={() => window.print()}>Print or save as PDF</button></div>
        <div className="print-sheet card p-8">
          <div className="flex justify-between"><div><h1 className="text-3xl font-bold">Invoice</h1><p className="text-sm text-muted">{o.orderNumber}</p></div><div className="text-right text-sm"><p className="font-display text-xl font-bold">Shop-Zone</p><p className="text-muted">Issued {date(o.createdAt)}</p></div></div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2"><div><h2 className="font-sans text-sm font-semibold">Billed to</h2><p className="text-sm text-muted">{o.email}</p></div><div><h2 className="font-sans text-sm font-semibold">Ship to</h2>{addr}</div></div>
          <div className="mt-6">{lines(o)}</div>{totals(o)}
          <p className="mt-8 text-xs text-muted">Payment status: {statusLabel[o.paymentStatus]}.</p>
        </div>
      </div>
    );
  }
  const cancellable = ['pending', 'processing'].includes(o.fulfillmentStatus);
  return (
    <div className="container-x max-w-3xl py-10">
      <Link to="/account" className="text-sm text-muted hover:text-ink">← All orders</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">{o.orderNumber}</h1><p className="text-sm text-muted">Placed {date(o.createdAt)}</p></div><div className="flex gap-2"><span className="chip">{statusLabel[o.fulfillmentStatus]}</span><span className="chip">{statusLabel[o.paymentStatus]}</span></div></div>
      {o.trackingNumber && <div className="card mt-6 p-4 text-sm">Tracking: <b>{o.trackingNumber}</b>{o.trackingCarrier ? ` (${o.trackingCarrier})` : ''}</div>}
      <section className="card mt-6 p-5" aria-label="Items">{lines(o)}{totals(o)}</section>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="card p-5"><h2 className="font-sans text-sm font-semibold">Shipping to</h2><div className="mt-2">{addr}</div></section>
        <section className="card p-5"><h2 className="font-sans text-sm font-semibold">Timeline</h2>
          <ol className="mt-2 space-y-2 text-sm">{[...o.timeline].reverse().map((t, i) => <li key={i}><b>{statusLabel[t.status] ?? t.status}</b> <span className="text-muted">{date(t.at)}{t.note ? `: ${t.note}` : ''}</span></li>)}</ol></section>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to={`/orders/${id}/invoice`} className="btn-ghost">View invoice</Link>
        {cancellable && <button className="btn-danger" disabled={cancel.isPending} onClick={() => window.confirm('Cancel this order? Paid orders are refunded in full.') && cancel.mutate()}>{cancel.isPending ? 'Cancelling…' : 'Cancel order'}</button>}
      </div>
    </div>
  );
}
