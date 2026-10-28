import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line/60 py-12 text-sm text-muted no-print">
      <div className="container-x grid gap-8 sm:grid-cols-3">
        <div>
          <p className="font-display text-lg font-bold text-ink">Shop-Zone</p>
          <p className="mt-2 max-w-xs">Well-made things for listening, working and living with. Payments run in Stripe test mode.</p>
        </div>
        <nav aria-label="Shop" className="flex flex-col gap-2">
          <Link to="/shop" className="hover:text-ink">All products</Link>
          <Link to="/wishlist" className="hover:text-ink">Wishlist</Link>
          <Link to="/cart" className="hover:text-ink">Cart</Link>
        </nav>
        <nav aria-label="Account" className="flex flex-col gap-2">
          <Link to="/account" className="hover:text-ink">Your account</Link>
          <Link to="/login" className="hover:text-ink">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}
