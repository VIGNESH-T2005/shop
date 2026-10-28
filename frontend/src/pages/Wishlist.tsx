import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState } from '../components/StateViews';
import { GridSkeleton } from '../components/Skeleton';
import { ProductCard } from '../components/ProductCard';
import { api } from '../lib/api';
import { useWishlist } from '../store/wishlist';
import type { Product } from '../types';

export default function Wishlist() {
  const ids = useWishlist((s) => s.ids);
  const q = useQuery({ queryKey: ['wishlist-products', ids.join(',')], enabled: ids.length > 0, queryFn: () => api<Product[]>(`/products/by-ids?ids=${ids.join(',')}`) });
  return (
    <div className="container-x py-10">
      <h1 className="text-4xl font-bold">Wishlist</h1>
      <div className="mt-8">
        {ids.length === 0 && <EmptyState title="Nothing saved yet" body="Tap the heart on any product to keep it here. Your list follows you when you sign in." cta={{ to: '/shop', label: 'Browse the shop' }} />}
        {ids.length > 0 && q.isLoading && <GridSkeleton n={4} />}
        {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {q.data && <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">{q.data.filter((p) => ids.includes(p._id)).map((p) => <ProductCard key={p._id} p={p} />)}</div>}
      </div>
    </div>
  );
}
