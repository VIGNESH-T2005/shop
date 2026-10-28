import { Link } from 'react-router-dom';
import { discountPct, money } from '../lib/format';
import { useWishlist } from '../store/wishlist';
import type { Product } from '../types';
import { Stars } from './Stars';

export function ProductCard({ p }: { p: Product }) {
  const wished = useWishlist((s) => s.ids.includes(p._id));
  const toggle = useWishlist((s) => s.toggle);
  const off = discountPct(p.price, p.compareAtPrice);
  const soldOut = p.totalStock <= 0;
  return (
    <article className="group relative">
      <Link to={`/product/${p.slug}`} className="block" aria-label={`${p.title}, ${money(p.price)}`}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl2 bg-raised">
          {p.images[0] && <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />}
          {off > 0 && !soldOut && <span className="absolute left-3 top-3 rounded-full bg-brass px-2.5 py-1 text-xs font-bold text-bg">{off}% off</span>}
          {soldOut && <span className="absolute left-3 top-3 rounded-full bg-bg/80 px-2.5 py-1 text-xs font-semibold">Sold out</span>}
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-xs text-muted">{p.brand}</p>
          <h3 className="font-sans text-[15px] font-semibold leading-snug tracking-normal">{p.title}</h3>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm"><span className="font-semibold">{money(p.price)}</span>{p.compareAtPrice ? <s className="ml-2 text-muted">{money(p.compareAtPrice)}</s> : null}</p>
            {p.ratingCount > 0 && <Stars value={p.ratingAverage} size={12} />}
          </div>
        </div>
      </Link>
      <button onClick={() => toggle(p._id)} aria-pressed={wished} aria-label={wished ? `Remove ${p.title} from wishlist` : `Add ${p.title} to wishlist`}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-bg/70 backdrop-blur transition-transform hover:scale-110 active:scale-90">
        <svg viewBox="0 0 24 24" width="18" height="18" fill={wished ? 'rgb(var(--brass))' : 'none'} stroke={wished ? 'rgb(var(--brass))' : 'currentColor'} strokeWidth="2" aria-hidden><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /></svg>
      </button>
    </article>
  );
}
