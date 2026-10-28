import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { Skeleton } from '../../components/Skeleton';
import { api, apiList, ApiError } from '../../lib/api';
import { date, money } from '../../lib/format';
import { toast } from '../../store/ui';
import type { Category, Coupon, Product, Variant } from '../../types';

const errText = (e: unknown) => (e instanceof ApiError && e.details?.length ? e.details.map((d) => `${d.path}: ${d.message}`).join('; ') : (e as Error).message);
const dollars = (c?: number) => (c === undefined || c === null ? '' : String(c / 100));
const cents = (s: string) => Math.round(Number(s) * 100);

/* ---------------- Products ---------------- */
interface PForm { id?: string; title: string; brand: string; category: string; price: string; compareAtPrice: string; description: string; images: string; tags: string; isActive: boolean; shape: string; color: string; variants: Variant[] }
const blank = (cat = ''): PForm => ({ title: '', brand: '', category: cat, price: '', compareAtPrice: '', description: '', images: '', tags: '', isActive: true, shape: 'knot', color: '#b794f6', variants: [{ sku: '', color: '', size: '', stock: 0 }] });

function ProductForm({ initial, cats, onDone }: { initial: PForm; cats: Category[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(initial);
  const set = <K extends keyof PForm>(k: K, v: PForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const setVar = (i: number, patch: Partial<Variant>) => set('variants', f.variants.map((v, n) => (n === i ? { ...v, ...patch } : v)));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: f.title, brand: f.brand, category: f.category, description: f.description, price: cents(f.price), compareAtPrice: f.compareAtPrice ? cents(f.compareAtPrice) : null,
        images: f.images.split('\n').map((s) => s.trim()).filter(Boolean), tags: f.tags.split(',').map((s) => s.trim()).filter(Boolean), isActive: f.isActive,
        variants: f.variants.map((v) => ({ sku: v.sku, size: v.size || undefined, color: v.color || undefined, stock: Number(v.stock) })),
        viewer: { shape: f.shape, color: f.color },
      };
      return api(f.id ? `/admin/products/${f.id}` : '/admin/products', { method: f.id ? 'PUT' : 'POST', body });
    },
    onSuccess: () => { toast.success(f.id ? 'Product updated.' : 'Product created.'); qc.invalidateQueries({ queryKey: ['admin-products'] }); onDone(); },
    onError: (e) => toast.error(errText(e)),
  });
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const form = new FormData();
    [...files].forEach((x) => form.append('images', x));
    try { const r = await api<{ urls: string[] }>('/admin/upload', { method: 'POST', form }); set('images', [f.images, ...r.urls].filter(Boolean).join('\n')); toast.success('Images uploaded.'); } catch (e) { toast.error((e as Error).message); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  const L = ({ children }: { children: string }) => <span className="label">{children}</span>;
  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <h2 className="font-sans text-xl font-bold">{f.id ? 'Edit product' : 'New product'}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label><L>Title</L><input className="input" required value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label><L>Brand</L><input className="input" required value={f.brand} onChange={(e) => set('brand', e.target.value)} /></label>
        <label><L>Category</L><select className="input" required value={f.category} onChange={(e) => set('category', e.target.value)}><option value="">Choose…</option>{cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
        <label><L>Price (USD)</L><input className="input" required inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} /></label>
        <label><L>Compare-at price (optional)</L><input className="input" inputMode="decimal" value={f.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} /></label>
        <label><L>Tags (comma separated)</L><input className="input" value={f.tags} onChange={(e) => set('tags', e.target.value)} /></label>
      </div>
      <label className="block"><L>Description</L><textarea className="input min-h-24" required minLength={10} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
      <label className="block"><L>Image URLs (one per line)</L><textarea className="input min-h-20 font-mono text-xs" value={f.images} onChange={(e) => set('images', e.target.value)} /></label>
      <div><label className="btn-ghost cursor-pointer">Upload images<input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} /></label><span className="ml-3 text-xs text-muted">Needs Cloudinary on the server. Otherwise paste URLs.</span></div>
      <fieldset><legend className="label">Variants</legend>
        <div className="space-y-2">{f.variants.map((v, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_1fr_90px_auto]">
            <input className="input" placeholder="SKU" aria-label="SKU" required value={v.sku} onChange={(e) => setVar(i, { sku: e.target.value })} />
            <input className="input" placeholder="Color" aria-label="Color" value={v.color ?? ''} onChange={(e) => setVar(i, { color: e.target.value })} />
            <input className="input" placeholder="Size" aria-label="Size" value={v.size ?? ''} onChange={(e) => setVar(i, { size: e.target.value })} />
            <input className="input" type="number" min={0} placeholder="Stock" aria-label="Stock" required value={v.stock} onChange={(e) => setVar(i, { stock: Number(e.target.value) })} />
            <button type="button" className="btn-ghost" disabled={f.variants.length === 1} onClick={() => set('variants', f.variants.filter((_, n) => n !== i))} aria-label="Remove variant">✕</button>
          </div>))}</div>
        <button type="button" className="btn-ghost mt-2" onClick={() => set('variants', [...f.variants, { sku: '', color: '', size: '', stock: 0 }])}>Add variant</button>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <label><L>3D shape</L><select className="input" value={f.shape} onChange={(e) => set('shape', e.target.value)}>{['knot', 'torus', 'sphere', 'box', 'cone', 'capsule'].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label><L>3D color</L><input type="color" className="input !p-1 h-11" value={f.color} onChange={(e) => set('color', e.target.value)} /></label>
        <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" className="accent-[rgb(var(--brass))]" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Visible in the shop</label>
      </div>
      <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onDone}>Cancel</button><button className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save product'}</button></div>
    </form>
  );
}

function Products() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PForm | null>(null);
  const cats = useQuery({ queryKey: ['admin-cats'], queryFn: () => api<Category[]>('/admin/categories') });
  const q = useQuery({ queryKey: ['admin-products', page, search], queryFn: () => apiList<Product>(`/admin/products?page=${page}&limit=15${search ? `&q=${encodeURIComponent(search)}` : ''}`) });
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/products/${id}`, { method: 'DELETE' }), onSuccess: () => { toast.success('Product deleted.'); qc.invalidateQueries({ queryKey: ['admin-products'] }); }, onError: (e) => toast.error(errText(e)) });
  if (editing) return <ProductForm initial={editing} cats={cats.data ?? []} onDone={() => setEditing(null)} />;
  const edit = (p: Product): PForm => ({ id: p._id, title: p.title, brand: p.brand, category: p.category._id, price: dollars(p.price), compareAtPrice: dollars(p.compareAtPrice), description: p.description ?? '', images: p.images.join('\n'), tags: p.tags.join(', '), isActive: p.isActive, shape: p.viewer?.shape ?? 'knot', color: p.viewer?.color ?? '#b794f6', variants: p.variants });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Products</h1><div className="flex gap-2"><input className="input !w-56" type="search" placeholder="Search products" aria-label="Search products" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /><button className="btn-primary" onClick={() => setEditing(blank(cats.data?.[0]?._id))}>New product</button></div></div>
      {q.isLoading && <Skeleton className="h-64" />}{q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No products found" />}
      {q.data && q.data.items.length > 0 && (
        <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Products</caption>
          <thead className="border-b border-line text-muted"><tr><th className="p-3">Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>{q.data.items.map((p) => (
            <tr key={p._id} className="border-b border-line/50"><td className="p-3 font-medium">{p.title}<div className="text-xs text-muted">{p.brand}</div></td><td>{p.category?.name}</td><td>{money(p.price)}</td><td className={p.totalStock <= 5 ? 'text-brass' : ''}>{p.totalStock}</td><td>{p.isActive ? 'Visible' : 'Hidden'}</td>
              <td className="p-3 text-right"><button className="mr-3 underline" onClick={() => setEditing(edit(p))}>Edit</button><button className="text-danger underline" onClick={() => window.confirm(`Delete “${p.title}”? This cannot be undone.`) && del.mutate(p._id)}>Delete</button></td></tr>))}</tbody></table></div>
      )}
      {q.data && q.data.meta.pages > 1 && <div className="flex items-center justify-center gap-3"><button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="text-sm text-muted">Page {page} of {q.data.meta.pages}</span><button className="btn-ghost" disabled={page >= q.data.meta.pages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </div>
  );
}

/* ---------------- Categories ---------------- */
function Categories() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-cats'], queryFn: () => api<Category[]>('/admin/categories') });
  const [form, setForm] = useState<{ id?: string; name: string; description: string; isActive: boolean } | null>(null);
  const save = useMutation({
    mutationFn: () => api(form!.id ? `/admin/categories/${form!.id}` : '/admin/categories', { method: form!.id ? 'PUT' : 'POST', body: { name: form!.name, description: form!.description || undefined, isActive: form!.isActive } }),
    onSuccess: () => { toast.success('Category saved.'); setForm(null); qc.invalidateQueries({ queryKey: ['admin-cats'] }); qc.invalidateQueries({ queryKey: ['categories'] }); }, onError: (e) => toast.error(errText(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/categories/${id}`, { method: 'DELETE' }), onSuccess: () => { toast.success('Category deleted.'); qc.invalidateQueries({ queryKey: ['admin-cats'] }); }, onError: (e) => toast.error(errText(e)) });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-3xl font-bold">Categories</h1><button className="btn-primary" onClick={() => setForm({ name: '', description: '', isActive: true })}>New category</button></div>
      {form && (
        <form className="card grid gap-4 p-5 sm:grid-cols-[1fr_2fr_auto]" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <input className="input" required placeholder="Name" aria-label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Description" aria-label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--brass))]" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Active</label><button className="btn-primary" disabled={save.isPending}>Save</button><button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      {q.isLoading && <Skeleton className="h-40" />}{q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && <ul className="card divide-y divide-line">{q.data.map((c) => <li key={c._id} className="flex items-center justify-between p-4 text-sm"><div><b>{c.name}</b> <span className="text-muted">/{c.slug}</span>{!c.isActive && <span className="chip ml-2">Hidden</span>}<p className="text-muted">{c.description}</p></div><div className="flex gap-3"><button className="underline" onClick={() => setForm({ id: c._id, name: c.name, description: c.description ?? '', isActive: c.isActive })}>Edit</button><button className="text-danger underline" onClick={() => window.confirm(`Delete ${c.name}?`) && del.mutate(c._id)}>Delete</button></div></li>)}</ul>}
    </div>
  );
}

/* ---------------- Coupons ---------------- */
interface CForm { id?: string; code: string; description: string; type: 'percent' | 'fixed'; value: string; minSubtotal: string; maxDiscount: string; expiresAt: string; usageLimit: string; isActive: boolean }
function Coupons() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-coupons'], queryFn: () => api<Coupon[]>('/admin/coupons') });
  const [f, setF] = useState<CForm | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const x = f!;
      const body = { code: x.code, description: x.description || undefined, type: x.type, value: x.type === 'percent' ? Number(x.value) : cents(x.value), minSubtotal: x.minSubtotal ? cents(x.minSubtotal) : 0, maxDiscount: x.maxDiscount ? cents(x.maxDiscount) : undefined, expiresAt: x.expiresAt || undefined, usageLimit: x.usageLimit ? Number(x.usageLimit) : undefined, isActive: x.isActive };
      return api(x.id ? `/admin/coupons/${x.id}` : '/admin/coupons', { method: x.id ? 'PUT' : 'POST', body });
    },
    onSuccess: () => { toast.success('Coupon saved.'); setF(null); qc.invalidateQueries({ queryKey: ['admin-coupons'] }); }, onError: (e) => toast.error(errText(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/coupons/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-coupons'] }) });
  const edit = (c: Coupon): CForm => ({ id: c._id, code: c.code, description: c.description ?? '', type: c.type, value: c.type === 'percent' ? String(c.value) : dollars(c.value), minSubtotal: dollars(c.minSubtotal) === '0' ? '' : dollars(c.minSubtotal), maxDiscount: dollars(c.maxDiscount), expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '', usageLimit: c.usageLimit ? String(c.usageLimit) : '', isActive: c.isActive });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-3xl font-bold">Coupons</h1><button className="btn-primary" onClick={() => setF({ code: '', description: '', type: 'percent', value: '', minSubtotal: '', maxDiscount: '', expiresAt: '', usageLimit: '', isActive: true })}>New coupon</button></div>
      {f && (
        <form className="card grid gap-3 p-5 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <input className="input" required placeholder="CODE" aria-label="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <select className="input" aria-label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as 'percent' | 'fixed' })}><option value="percent">Percent off</option><option value="fixed">Dollars off</option></select>
          <input className="input" required inputMode="decimal" placeholder={f.type === 'percent' ? 'Percent (1-100)' : 'Dollars off'} aria-label="Value" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
          <input className="input" placeholder="Description" aria-label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <input className="input" inputMode="decimal" placeholder="Min. subtotal ($)" aria-label="Minimum subtotal" value={f.minSubtotal} onChange={(e) => setF({ ...f, minSubtotal: e.target.value })} />
          <input className="input" inputMode="decimal" placeholder="Max discount ($)" aria-label="Maximum discount" value={f.maxDiscount} onChange={(e) => setF({ ...f, maxDiscount: e.target.value })} />
          <input className="input" type="date" aria-label="Expires" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />
          <input className="input" type="number" min={1} placeholder="Usage limit" aria-label="Usage limit" value={f.usageLimit} onChange={(e) => setF({ ...f, usageLimit: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--brass))]" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />Active</label>
          <div className="flex gap-2 sm:col-span-3 sm:justify-end"><button type="button" className="btn-ghost" onClick={() => setF(null)}>Cancel</button><button className="btn-primary" disabled={save.isPending}>Save coupon</button></div>
        </form>
      )}
      {q.isLoading && <Skeleton className="h-40" />}{q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && <EmptyState title="No coupons yet" />}
      {q.data && q.data.length > 0 && <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Coupons</caption><thead className="border-b border-line text-muted"><tr><th className="p-3">Code</th><th>Discount</th><th>Min.</th><th>Used</th><th>Expires</th><th className="p-3 text-right">Actions</th></tr></thead>
        <tbody>{q.data.map((c) => <tr key={c._id} className="border-b border-line/50"><td className="p-3 font-mono font-semibold">{c.code}{!c.isActive && <span className="chip ml-2">Off</span>}</td><td>{c.type === 'percent' ? `${c.value}%` : money(c.value)}</td><td>{c.minSubtotal ? money(c.minSubtotal) : 'None'}</td><td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td><td>{c.expiresAt ? date(c.expiresAt) : 'Never'}</td><td className="p-3 text-right"><button className="mr-3 underline" onClick={() => setF(edit(c))}>Edit</button><button className="text-danger underline" onClick={() => window.confirm(`Delete ${c.code}?`) && del.mutate(c._id)}>Delete</button></td></tr>)}</tbody></table></div>}
    </div>
  );
}

export default function AdminCatalog({ tab }: { tab: 'products' | 'categories' | 'coupons' }) {
  return tab === 'products' ? <Products /> : tab === 'categories' ? <Categories /> : <Coupons />;
}
