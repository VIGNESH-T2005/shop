import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState } from '../components/StateViews';
import { GridSkeleton } from '../components/Skeleton';
import { ProductCard } from '../components/ProductCard';
import { api, apiList, qs } from '../lib/api';
import type { Category, Product } from '../types';

export default function Shop() {
  const [sp, setSp] = useSearchParams();
  const get = (k: string) => sp.get(k) ?? '';
  const page = Number(get('page')) || 1;
  const q = get('q');
  const sort = get('sort') || (q ? 'relevance' : 'newest');
  const brands = get('brand') ? get('brand').split(',') : [];

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setSp(next, { replace: false });
  };

  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const facets = useQuery({ queryKey: ['facets'], queryFn: () => api<{ brands: { name: string; count: number }[]; price: { min: number; max: number } }>('/products/facets') });
  const query = useQuery({
    queryKey: ['products', sp.toString()],
    queryFn: () => apiList<Product>(`/products${qs({ q, category: get('category'), brand: get('brand'), minPrice: get('minPrice'), maxPrice: get('maxPrice'), rating: get('rating'), inStock: get('inStock'), sort, page, limit: 12 })}`),
    placeholderData: keepPreviousData,
  });

  const [min, setMin] = useState(get('minPrice') ? String(Number(get('minPrice')) / 100) : '');
  const [max, setMax] = useState(get('maxPrice') ? String(Number(get('maxPrice')) / 100) : '');
  useEffect(() => {
    setMin(get('minPrice') ? String(Number(get('minPrice')) / 100) : '');
    setMax(get('maxPrice') ? String(Number(get('maxPrice')) / 100) : '');
  }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const applyPrice = (e: FormEvent) => {
    e.preventDefault();
    set({ minPrice: min ? String(Math.round(Number(min) * 100)) : undefined, maxPrice: max ? String(Math.round(Number(max) * 100)) : undefined });
  };
  const toggleBrand = (b: string) => set({ brand: (brands.includes(b) ? brands.filter((x) => x !== b) : [...brands, b]).join(',') || undefined });
  const activeCat = cats.data?.find((c) => c.slug === get('category'));
  const meta = query.data?.meta;
  const hasFilters = ['category', 'brand', 'minPrice', 'maxPrice', 'rating', 'inStock'].some((k) => get(k));

  const filters = (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Category</legend>
        <div className="flex flex-wrap gap-2">
          <button className={`chip ${!get('category') ? '!border-brass !text-ink' : ''}`} aria-pressed={!get('category')} onClick={() => set({ category: undefined })}>All</button>
          {cats.data?.map((c) => <button key={c._id} className={`chip ${get('category') === c.slug ? '!border-brass !text-ink' : ''}`} aria-pressed={get('category') === c.slug} onClick={() => set({ category: c.slug })}>{c.name}</button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Brand</legend>
        <div className="space-y-1.5">
          {facets.data?.brands.map((b) => (
            <label key={b.name} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[rgb(var(--brass))]" checked={brands.includes(b.name)} onChange={() => toggleBrand(b.name)} />
              {b.name} <span className="text-muted">({b.count})</span>
            </label>
          ))}
        </div>
      </fieldset>
      <form onSubmit={applyPrice}>
        <p className="mb-2 text-sm font-semibold">Price (USD)</p>
        <div className="flex items-center gap-2">
          <input className="input !px-3" inputMode="numeric" placeholder={facets.data ? String(Math.floor(facets.data.price.min / 100)) : 'Min'} aria-label="Minimum price" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} />
          <span className="text-muted">to</span>
          <input className="input !px-3" inputMode="numeric" placeholder={facets.data ? String(Math.ceil(facets.data.price.max / 100)) : 'Max'} aria-label="Maximum price" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} />
        </div>
        <button className="btn-ghost mt-2 w-full !py-1.5">Apply price</button>
      </form>
      <div>
        <label htmlFor="rating" className="mb-2 block text-sm font-semibold">Rating</label>
        <select id="rating" className="input" value={get('rating')} onChange={(e) => set({ rating: e.target.value || undefined })}>
          <option value="">Any rating</option><option value="4">4 stars and up</option><option value="3">3 stars and up</option>
        </select>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="accent-[rgb(var(--brass))]" checked={get('inStock') === 'true'} onChange={(e) => set({ inStock: e.target.checked ? 'true' : undefined })} /> In stock only
      </label>
      {hasFilters && <button className="text-sm text-brass underline" onClick={() => setSp(q ? { q } : {})}>Clear all filters</button>}
    </div>
  );

  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">{q ? `Results for “${q}”` : activeCat?.name ?? 'All products'}</h1>
          {activeCat?.description && <p className="mt-2 text-muted">{activeCat.description}</p>}
          {meta && <p className="mt-1 text-sm text-muted" aria-live="polite">{meta.total} {meta.total === 1 ? 'product' : 'products'}</p>}
        </div>
        <div>
          <label htmlFor="sort" className="sr-only">Sort by</label>
          <select id="sort" className="input !w-auto" value={sort} onChange={(e) => set({ sort: e.target.value })}>
            {q && <option value="relevance">Most relevant</option>}
            <option value="newest">Newest</option><option value="popular">Most popular</option><option value="rating">Top rated</option>
            <option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
          </select>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Filters">
          <details className="lg:hidden card p-4"><summary className="cursor-pointer font-semibold">Filters{hasFilters ? ' (active)' : ''}</summary><div className="mt-4">{filters}</div></details>
          <div className="hidden lg:block">{filters}</div>
        </aside>
        <section aria-busy={query.isFetching} className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {query.isLoading && <GridSkeleton n={9} />}
          {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
          {query.data && query.data.items.length === 0 && <EmptyState title="No products match" body="Try removing a filter or searching for something broader." />}
          {query.data && query.data.items.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">{query.data.items.map((p) => <ProductCard key={p._id} p={p} />)}</div>
              {meta && meta.pages > 1 && (
                <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
                  <button className="btn-ghost" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>Previous</button>
                  <span className="px-3 text-sm text-muted">Page {meta.page} of {meta.pages}</span>
                  <button className="btn-ghost" disabled={page >= meta.pages} onClick={() => set({ page: String(page + 1) })}>Next</button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
