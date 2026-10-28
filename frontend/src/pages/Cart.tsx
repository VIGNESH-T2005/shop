import { Link } from 'react-router-dom';
import { Totals } from '../components/Totals';
import { EmptyState, ErrorState } from '../components/StateViews';
import { Skeleton } from '../components/Skeleton';
import { usePricedCart } from '../hooks/usePricedCart';
import { money } from '../lib/format';
import { useCart } from '../store/cart';
import { useCheckout } from '../store/checkout';

export default function Cart() {
  const items = useCart((s) => s.items);
  const { setQty, remove } = useCart.getState();
  const coupon = useCheckout((s) => s.coupon);
  const q = usePricedCart({ couponCode: coupon });

  if (!items.length) return <div className="container-x py-20"><EmptyState title="Your cart is empty" body="Add something you’ll actually use." cta={{ to: '/shop', label: 'Browse the shop' }} /></div>;
  if (q.isError) return <div className="container-x py-20"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data;

  return (
    <div className="container-x py-10">
      <h1 className="text-4xl font-bold">Your cart</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-line">
          {!d && items.map((i) => <li key={i.productId + i.sku} className="py-5"><Skeleton className="h-24 w-full" /></li>)}
          {d?.lines.map((l) => (
            <li key={l.productId + l.sku} className="flex gap-4 py-5">
              <Link to={`/product/${l.slug}`} className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-raised">{l.image && <img src={l.image} alt="" className="h-full w-full object-cover" />}</Link>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <div><Link to={`/product/${l.slug}`} className="font-semibold hover:underline">{l.title}</Link><p className="text-sm text-muted">{l.variantLabel}</p></div>
                  <p className="font-semibold">{money(l.lineTotal)}</p>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center rounded-xl border border-line" role="group" aria-label={`Quantity for ${l.title}`}>
                    <button className="h-9 w-9" aria-label="Decrease quantity" onClick={() => setQty(l.productId, l.sku, l.qty - 1)}>−</button>
                    <span className="w-8 text-center text-sm">{l.qty}</span>
                    <button className="h-9 w-9 disabled:opacity-40" aria-label="Increase quantity" disabled={l.qty >= l.stock} onClick={() => setQty(l.productId, l.sku, l.qty + 1)}>+</button>
                  </div>
                  <button className="text-sm text-muted underline hover:text-danger" onClick={() => remove(l.productId, l.sku)}>Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <aside className="card h-fit p-6 lg:sticky lg:top-24" aria-label="Order summary">
          <h2 className="mb-4 font-sans text-lg font-bold">Summary</h2>
          {d ? <Totals d={d} estimate /> : <Skeleton className="h-32" />}
          <Link to="/checkout" className={`btn-primary mt-6 w-full !py-3 ${!d?.lines.length ? 'pointer-events-none opacity-50' : ''}`}>Checkout</Link>
          <p className="mt-3 text-center text-xs text-muted">Shipping and tax are finalized at checkout.</p>
        </aside>
      </div>
    </div>
  );
}
