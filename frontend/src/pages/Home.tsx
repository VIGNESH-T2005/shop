import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { lazy, Suspense, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from '../components/StateViews';
import { GridSkeleton } from '../components/Skeleton';
import { ProductCard } from '../components/ProductCard';
import { api, apiList } from '../lib/api';
import { prefersReducedMotion } from '../lib/format';
import type { Category, Product } from '../types';

const Product3D = lazy(() => import('../components/Product3D'));
gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const featured = useQuery({ queryKey: ['featured'], queryFn: () => apiList<Product>('/products?sort=popular&limit=8') });

  // One orchestrated moment on load: the headline settles, then the stage fades in.
  useLayoutEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.hero-line', { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.12 })
        .from('.hero-fade', { opacity: 0, y: 14, duration: 0.6, stagger: 0.08 }, '-=0.4')
        .from('.hero-stage', { opacity: 0, scale: 0.94, duration: 1 }, 0.2);
    }, root);
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    if (prefersReducedMotion() || !featured.data) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.batch('.reveal-card', {
        start: 'top 90%', once: true,
        onEnter: (els) => gsap.from(els, { opacity: 0, y: 28, duration: 0.6, stagger: 0.08, ease: 'power2.out', clearProps: 'all' }),
      });
    }, root);
    return () => ctx.revert();
  }, [featured.data]);

  return (
    <div ref={root}>
      <section className="container-x grid items-center gap-8 pb-10 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div>
          <h1 className="text-[clamp(2.8rem,7vw,5.6rem)] font-bold">
            <span className="block overflow-hidden"><span className="hero-line block">Objects</span></span>
            <span className="block overflow-hidden"><span className="hero-line block">worth keeping.</span></span>
          </h1>
          <p className="hero-fade mt-6 max-w-md text-lg text-muted">Audio, wearables and desk gear picked for how they feel in month six, not just on day one.</p>
          <div className="hero-fade mt-8 flex flex-wrap gap-3">
            <Link to="/shop" className="btn-primary !px-7 !py-3">Shop the collection</Link>
            <Link to="/shop?sort=popular" className="btn-ghost !px-7 !py-3">See what’s popular</Link>
          </div>
        </div>
        <div className="hero-stage relative aspect-square w-full overflow-hidden rounded-[2rem] border border-line bg-[radial-gradient(circle_at_50%_35%,rgb(var(--raised)),rgb(var(--bg)))] lg:aspect-[5/5]">
          <Suspense fallback={<div className="skeleton h-full w-full" />}>
            <Product3D shape="knot" color="#b794f6" label="Interactive 3D object. Drag to rotate." />
          </Suspense>
          <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-muted">Drag to turn it</p>
        </div>
      </section>

      <section className="container-x mt-16" aria-labelledby="cats">
        <h2 id="cats" className="text-3xl font-bold">Start with what you need</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {cats.isLoading && Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-28" />)}
          {cats.data?.map((c) => (
            <Link key={c._id} to={`/shop?category=${c.slug}`} className="group card flex h-28 flex-col justify-end p-4 transition-colors hover:border-brass/60 hover:bg-raised">
              <span className="font-display text-lg font-bold">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-x mt-20" aria-labelledby="pop">
        <div className="flex items-end justify-between">
          <h2 id="pop" className="text-3xl font-bold">Most loved right now</h2>
          <Link to="/shop?sort=popular" className="text-sm text-muted hover:text-ink">View all</Link>
        </div>
        <div className="mt-8">
          {featured.isLoading && <GridSkeleton n={8} />}
          {featured.isError && <ErrorState error={featured.error} onRetry={() => featured.refetch()} />}
          {featured.data && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {featured.data.items.map((p) => <div key={p._id} className="reveal-card"><ProductCard p={p} /></div>)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
