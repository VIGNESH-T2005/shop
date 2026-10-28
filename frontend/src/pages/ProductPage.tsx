import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, MouseEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { ErrorState } from '../components/StateViews';
import { Skeleton } from '../components/Skeleton';
import { Stars } from '../components/Stars';
import { api, apiList, ApiError } from '../lib/api';
import { date, discountPct, money } from '../lib/format';
import { useAuth } from '../store/auth';
import { useCart } from '../store/cart';
import { toast } from '../store/ui';
import { useWishlist } from '../store/wishlist';
import type { Product, Review } from '../types';

const Product3D = lazy(() => import('../components/Product3D'));

function Gallery({ p }: { p: Product }) {
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<'photo' | '3d'>('photo');
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const move = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl2 bg-raised">
        {mode === '3d' ? (
          <Suspense fallback={<Skeleton className="h-full w-full" />}><Product3D shape={p.viewer?.shape} color={p.viewer?.color} modelUrl={p.viewer?.modelUrl} label={`3D preview of ${p.title}. Drag to rotate.`} /></Suspense>
        ) : p.images[i] ? (
          <div className="h-full w-full cursor-zoom-in" onMouseMove={zoom ? move : undefined} onMouseLeave={() => setZoom(false)} onClick={() => setZoom((z) => !z)} role="button" tabIndex={0} aria-label={zoom ? 'Zoom out' : 'Zoom in'} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setZoom((z) => !z))}>
            <img src={p.images[i]} alt={`${p.title}, view ${i + 1}`} className="h-full w-full object-cover transition-transform duration-200" style={{ transform: zoom ? 'scale(2.2)' : 'scale(1)', transformOrigin: origin }} />
          </div>
        ) : <div className="grid h-full place-items-center text-muted">No image</div>}
        {p.viewer && (
          <div className="absolute bottom-3 left-3 flex gap-1 rounded-full bg-bg/80 p-1 backdrop-blur" role="tablist" aria-label="Media">
            {(['photo', '3d'] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === m ? 'bg-brass text-bg' : 'text-muted'}`}>{m === 'photo' ? 'Photos' : '3D view'}</button>)}
          </div>
        )}
      </div>
      {p.images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {p.images.map((src, n) => (
            <button key={src} onClick={() => { setI(n); setMode('photo'); }} aria-label={`Show image ${n + 1}`} aria-current={mode === 'photo' && i === n} className={`h-20 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${mode === 'photo' && i === n ? 'border-brass' : 'border-transparent opacity-70'}`}><img src={src} alt="" className="h-full w-full object-cover" loading="lazy" /></button>
          ))}
        </div>
      )}
    </div>
  );
}

function Reviews({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ['reviews', slug, page], queryFn: () => apiList<Review>(`/products/${slug}/reviews?page=${page}`) });
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const submit = useMutation({
    mutationFn: () => api(`/products/${slug}/reviews`, { method: 'POST', body: { rating, body, title: title || undefined } }),
    onSuccess: () => { toast.success('Thanks for your review.'); setBody(''); setTitle(''); qc.invalidateQueries({ queryKey: ['reviews', slug] }); qc.invalidateQueries({ queryKey: ['product', slug] }); },
    onError: (e) => toast.error(e instanceof ApiError && e.status === 409 ? 'You have already reviewed this product.' : (e as Error).message),
  });
  return (
    <section className="mt-16" aria-labelledby="rev">
      <h2 id="rev" className="text-2xl font-bold">Reviews</h2>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          {list.isLoading && <Skeleton className="h-24 w-full" />}
          {list.data?.items.length === 0 && <p className="text-muted">No reviews yet. Be the first to share how it holds up.</p>}
          {list.data?.items.map((r) => (
            <article key={r._id} className="border-b border-line pb-5">
              <div className="flex items-center gap-3"><Stars value={r.rating} /><b className="text-sm">{r.title}</b></div>
              <p className="mt-2 text-sm">{r.body}</p>
              <p className="mt-2 text-xs text-muted">{r.userName} · {date(r.createdAt)}{r.verifiedPurchase ? ' · Verified purchase' : ''}</p>
            </article>
          ))}
          {list.data && list.data.meta.pages > 1 && (
            <div className="flex gap-2"><button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</button><button className="btn-ghost" disabled={page >= list.data.meta.pages} onClick={() => setPage(page + 1)}>Older</button></div>
          )}
        </div>
        <div className="card h-fit p-5">
          {user ? (
            <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-3">
              <h3 className="font-sans text-base font-semibold">Write a review</h3>
              <div role="radiogroup" aria-label="Rating" className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? 'text-brass' : 'text-line'}`}>★</button>)}
              </div>
              <input className="input" placeholder="Headline (optional)" aria-label="Review headline" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="input min-h-28" placeholder="What stood out, good or bad?" aria-label="Review" required minLength={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
              <button className="btn-primary w-full" disabled={submit.isPending}>{submit.isPending ? 'Posting…' : 'Post review'}</button>
            </form>
          ) : <p className="text-sm text-muted"><Link to="/login" className="text-brass underline">Sign in</Link> to review this product.</p>}
        </div>
      </div>
    </section>
  );
}

export default function ProductPage() {
  const { slug = '' } = useParams();
  const q = useQuery({ queryKey: ['product', slug], queryFn: () => api<{ product: Product; related: Product[] }>(`/products/${slug}`) });
  const add = useCart((s) => s.add);
  const wished = useWishlist((s) => (q.data ? s.ids.includes(q.data.product._id) : false));
  const toggleWish = useWishlist((s) => s.toggle);
  const [color, setColor] = useState<string | undefined>();
  const [size, setSize] = useState<string | undefined>();
  const [qty, setQty] = useState(1);

  const p = q.data?.product;
  const colors = useMemo(() => [...new Set(p?.variants.map((v) => v.color).filter(Boolean) as string[])], [p]);
  const sizes = useMemo(() => [...new Set(p?.variants.map((v) => v.size).filter(Boolean) as string[])], [p]);
  useEffect(() => {
    if (!p) return;
    const first = p.variants.find((v) => v.stock > 0) ?? p.variants[0];
    setColor(first.color); setSize(first.size); setQty(1);
    document.title = `${p.title} · Shop-Zone`;
    return () => { document.title = 'Shop-Zone'; };
  }, [p]);

  if (q.isLoading) return <div className="container-x grid gap-10 py-10 lg:grid-cols-2"><Skeleton className="aspect-[4/5]" /><div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-6 w-1/4" /><Skeleton className="h-32" /></div></div>;
  if (q.isError || !p) return <div className="container-x py-20"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;

  const variant = p.variants.find((v) => v.color === color && v.size === size);
  const stock = variant?.stock ?? 0;
  const existsInStock = (c?: string, s?: string) => p.variants.some((v) => v.color === c && v.size === s && v.stock > 0);
  const off = discountPct(p.price, p.compareAtPrice);

  const onAdd = () => {
    if (!variant || stock <= 0) return;
    add({ productId: p._id, sku: variant.sku, qty });
    toast.success(`${p.title} added to your cart.`);
  };

  return (
    <div className="container-x py-10">
      <nav className="mb-6 text-sm text-muted" aria-label="Breadcrumb"><Link to="/shop" className="hover:text-ink">Shop</Link> / <Link to={`/shop?category=${p.category.slug}`} className="hover:text-ink">{p.category.name}</Link></nav>
      <div className="grid gap-10 lg:grid-cols-2">
        <Gallery p={p} />
        <div>
          <p className="text-sm text-muted">{p.brand}</p>
          <h1 className="mt-1 text-4xl font-bold">{p.title}</h1>
          {p.ratingCount > 0 && <div className="mt-3"><Stars value={p.ratingAverage} count={p.ratingCount} size={16} /></div>}
          <p className="mt-5 flex items-baseline gap-3 text-3xl font-bold">{money(p.price)}{p.compareAtPrice ? <><s className="text-lg font-normal text-muted">{money(p.compareAtPrice)}</s><span className="text-sm font-semibold text-brass">{off}% off</span></> : null}</p>
          <p className="mt-5 max-w-prose text-muted">{p.description}</p>

          {colors.length > 0 && (
            <fieldset className="mt-7"><legend className="label">Color: <span className="font-normal text-muted">{color}</span></legend>
              <div className="flex flex-wrap gap-2">{colors.map((c) => <button key={c} onClick={() => setColor(c)} aria-pressed={c === color} className={`rounded-xl border px-4 py-2 text-sm ${c === color ? 'border-brass bg-brass/10' : 'border-line'} ${!sizes.length && !existsInStock(c, undefined) ? 'line-through opacity-50' : ''}`}>{c}</button>)}</div></fieldset>
          )}
          {sizes.length > 0 && (
            <fieldset className="mt-5"><legend className="label">Size</legend>
              <div className="flex flex-wrap gap-2">{sizes.map((s) => <button key={s} onClick={() => setSize(s)} aria-pressed={s === size} disabled={!existsInStock(color, s)} className={`min-w-12 rounded-xl border px-4 py-2 text-sm disabled:line-through disabled:opacity-40 ${s === size ? 'border-brass bg-brass/10' : 'border-line'}`}>{s}</button>)}</div></fieldset>
          )}

          <p className={`mt-6 text-sm font-medium ${stock <= 0 ? 'text-danger' : stock <= 5 ? 'text-brass' : 'text-ok'}`} role="status">
            {stock <= 0 ? 'Out of stock' : stock <= 5 ? `Only ${stock} left` : 'In stock'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-line" role="group" aria-label="Quantity">
              <button className="h-11 w-11 text-lg" aria-label="Decrease quantity" onClick={() => setQty((n) => Math.max(1, n - 1))}>−</button>
              <span className="w-8 text-center" aria-live="polite">{qty}</span>
              <button className="h-11 w-11 text-lg" aria-label="Increase quantity" onClick={() => setQty((n) => Math.min(stock || 1, n + 1))}>+</button>
            </div>
            <button className="btn-primary !px-8 !py-3 flex-1 sm:flex-none" disabled={stock <= 0} onClick={onAdd}>{stock <= 0 ? 'Sold out' : 'Add to cart'}</button>
            <button className="btn-ghost !py-3" aria-pressed={wished} onClick={() => toggleWish(p._id)}>{wished ? 'Saved' : 'Save for later'}</button>
          </div>
          <p className="mt-6 text-xs text-muted">Free standard shipping on orders over $100. Prices and stock are confirmed again at checkout.</p>
        </div>
      </div>
      <Reviews slug={slug} />
      {q.data!.related.length > 0 && (
        <section className="mt-20" aria-labelledby="rel"><h2 id="rel" className="text-2xl font-bold">You might also like</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">{q.data!.related.map((r) => <ProductCard key={r._id} p={r} />)}</div></section>
      )}
    </div>
  );
}
