import { FormEvent, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useCart } from '../store/cart';
import { useWishlist } from '../store/wishlist';

const link = ({ isActive }: { isActive: boolean }) => `text-sm transition-colors hover:text-ink ${isActive ? 'text-ink' : 'text-muted'}`;

export function Navbar() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const wish = useWishlist((s) => s.ids.length);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(`/shop${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
    setOpen(false);
  };
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-bg/80 backdrop-blur-lg">
      <a href="#main" className="sr-only-focusable absolute left-4 top-2 rounded bg-brass px-3 py-1 text-bg">Skip to content</a>
      <div className="container-x flex h-16 items-center gap-5">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight" aria-label="Shop-Zone home">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brass text-bg" aria-hidden>
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 18l7-12 7 12z" fill="currentColor" /></svg>
          </span>
          Shop-Zone
        </Link>
        <nav className="ml-4 hidden items-center gap-6 md:flex" aria-label="Main">
          <NavLink to="/shop" className={link}>Shop</NavLink>
          <NavLink to="/shop?category=audio" className={link}>Audio</NavLink>
          <NavLink to="/shop?category=wearables" className={link}>Wearables</NavLink>
          <NavLink to="/shop?category=home" className={link}>Home</NavLink>
        </nav>
        <form onSubmit={submit} role="search" className="ml-auto hidden max-w-xs flex-1 md:block">
          <input className="input !py-2" type="search" placeholder="Search products" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link to="/wishlist" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-raised" aria-label={`Wishlist, ${wish} items`}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /></svg>
            {wish > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brass" />}
          </Link>
          <Link to="/cart" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-raised" aria-label={`Cart, ${count} items`}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 7h13l-1.5 9h-10zM6 7L5 3H2" /><circle cx="9" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></svg>
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brass px-1 text-[11px] font-bold text-bg">{count}</span>}
          </Link>
          <div className="hidden items-center gap-2 pl-2 md:flex">
            {user ? (
              <>
                {user.role === 'admin' && <Link to="/admin" className="btn-ghost !py-1.5">Admin</Link>}
                <Link to="/account" className="btn-ghost !py-1.5">{user.name.split(' ')[0]}</Link>
                <button onClick={() => logout().then(() => { useCart.getState().clear(); useWishlist.getState().clear(); nav('/'); })} className="text-sm text-muted hover:text-ink">Sign out</button>
              </>
            ) : (
              <Link to="/login" className="btn-primary !py-1.5">Sign in</Link>
            )}
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-raised md:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden><path d={open ? 'M5 5l14 14M19 5L5 19' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-menu" className="container-x space-y-4 border-t border-line/60 pb-5 pt-4 md:hidden">
          <form onSubmit={submit} role="search"><input className="input" type="search" placeholder="Search products" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} /></form>
          <nav className="flex flex-col gap-3 text-base" onClick={() => setOpen(false)} aria-label="Mobile">
            <Link to="/shop">Shop</Link>
            {user ? (<><Link to="/account">My account</Link>{user.role === 'admin' && <Link to="/admin">Admin</Link>}<button className="text-left text-muted" onClick={() => logout().then(() => nav('/'))}>Sign out</button></>) : <Link to="/login" className="btn-primary">Sign in</Link>}
          </nav>
        </div>
      )}
    </header>
  );
}
