import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/StateViews';
import { Skeleton } from '../components/Skeleton';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { useAuth } from '../store/auth';
import { useCart } from '../store/cart';
import { useCheckout } from '../store/checkout';
import type { Order } from '../types';

export default function CheckoutSuccess() {
  const [sp] = useSearchParams();
  const sessionId = sp.get('session_id');
  const user = useAuth((s) => s.user);
  // The webhook creates the paid state, so poll briefly until it lands.
  const q = useQuery({
    queryKey: ['order-session', sessionId],
    enabled: !!sessionId,
    queryFn: () => api<Order>(`/orders/by-session?sessionId=${encodeURIComponent(sessionId!)}`),
    refetchInterval: (query) => (query.state.data?.paymentStatus === 'pending' && query.state.dataUpdateCount < 20 ? 2000 : false),
  });
  const order = q.data;
  const paid = order && order.paymentStatus !== 'pending' && order.paymentStatus !== 'failed';
  useEffect(() => { if (paid) { useCart.getState().clear(); useCheckout.getState().reset(); } }, [paid]);

  if (!sessionId) return <div className="container-x py-20"><EmptyState title="No order to show" cta={{ to: '/shop', label: 'Keep shopping' }} /></div>;
  if (q.isLoading) return <div className="container-x max-w-2xl py-20"><Skeleton className="h-64" /></div>;
  if (!order) return <div className="container-x py-20"><EmptyState title="We couldn’t find that order" body="If you were charged, a confirmation email will arrive shortly." cta={{ to: '/', label: 'Back home' }} /></div>;

  return (
    <div className="container-x max-w-2xl py-16">
      <div className="card p-8 text-center">
        {paid ? (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok/15 text-2xl text-ok" aria-hidden>✓</div>
            <h1 className="mt-5 text-3xl font-bold">Thank you. Your order is in.</h1>
            <p className="mt-2 text-muted">Order <b className="text-ink">{order.orderNumber}</b>. A confirmation is on its way to {order.email}.</p>
          </>
        ) : (
          <div role="status">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-line border-t-brass" aria-hidden />
            <h1 className="mt-5 text-2xl font-bold">Confirming your payment…</h1>
            <p className="mt-2 text-muted">This usually takes a few seconds. You can safely leave this page; we’ll email you when it’s confirmed.</p>
          </div>
        )}
        <ul className="mt-8 divide-y divide-line text-left text-sm">
          {order.items.map((i) => <li key={i.sku + i.product} className="flex justify-between py-3"><span>{i.title}{i.variantLabel ? ` (${i.variantLabel})` : ''} × {i.qty}</span><span>{money(i.unitPrice * i.qty)}</span></li>)}
          <li className="flex justify-between py-3 font-bold"><span>Total</span><span>{money(order.total)}</span></li>
        </ul>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {user && paid && <Link to={`/orders/${order._id}`} className="btn-primary">View order</Link>}
          <Link to="/shop" className="btn-ghost">Keep shopping</Link>
        </div>
      </div>
    </div>
  );
}
