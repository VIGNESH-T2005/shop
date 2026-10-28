import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { Skeleton } from '../../components/Skeleton';
import { api, apiList } from '../../lib/api';
import { date, money, statusLabel } from '../../lib/format';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/ui';
import type { Order } from '../../types';

function OrderPanel({ o, onClose }: { o: Order; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>(['processing', 'shipped', 'delivered'].includes(o.fulfillmentStatus) ? o.fulfillmentStatus : 'processing');
  const [tracking, setTracking] = useState(o.trackingNumber ?? '');
  const [carrier, setCarrier] = useState(o.trackingCarrier ?? '');
  const [refund, setRefund] = useState('');
  const done = () => qc.invalidateQueries({ queryKey: ['admin-orders'] });
  const update = useMutation({ mutationFn: () => api(`/admin/orders/${o._id}`, { method: 'PATCH', body: { fulfillmentStatus: status, trackingNumber: tracking || undefined, trackingCarrier: carrier || undefined } }), onSuccess: () => { toast.success('Order updated.'); done(); onClose(); }, onError: (e) => toast.error((e as Error).message) });
  const doRefund = useMutation({ mutationFn: () => api(`/admin/orders/${o._id}/refund`, { method: 'POST', body: refund ? { amountCents: Math.round(Number(refund) * 100) } : {} }), onSuccess: () => { toast.success('Refund issued through Stripe.'); done(); onClose(); }, onError: (e) => toast.error((e as Error).message) });
  const canFulfil = ['paid', 'partially_refunded'].includes(o.paymentStatus) && ['processing', 'shipped', 'delivered'].includes(o.fulfillmentStatus);
  const canRefund = ['paid', 'partially_refunded'].includes(o.paymentStatus) && o.total - o.refundedCents > 0;
  return (
    <div className="card mb-6 space-y-5 p-6">
      <div className="flex items-start justify-between"><div><h2 className="font-sans text-xl font-bold">{o.orderNumber}</h2><p className="text-sm text-muted">{o.email} · {date(o.createdAt)}</p></div><button className="btn-ghost" onClick={onClose}>Close</button></div>
      <ul className="text-sm">{o.items.map((i) => <li key={i.sku} className="flex justify-between py-1"><span>{i.title} ({i.variantLabel}) × {i.qty}</span><span>{money(i.unitPrice * i.qty)}</span></li>)}<li className="flex justify-between border-t border-line pt-2 font-bold"><span>Total</span><span>{money(o.total)}</span></li></ul>
      <p className="text-sm text-muted">Ship to: {o.shippingAddress.fullName}, {o.shippingAddress.line1}, {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.postalCode}, {o.shippingAddress.country}</p>
      {canFulfil && (
        <div className="grid gap-3 sm:grid-cols-4"><select className="input" aria-label="Fulfillment status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option></select>
          <input className="input" placeholder="Tracking number" aria-label="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} /><input className="input" placeholder="Carrier" aria-label="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} /><button className="btn-primary" disabled={update.isPending} onClick={() => update.mutate()}>Save status</button></div>
      )}
      {canRefund && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4"><input className="input !w-48" inputMode="decimal" placeholder={`Amount (max ${money(o.total - o.refundedCents)})`} aria-label="Refund amount" value={refund} onChange={(e) => setRefund(e.target.value)} /><button className="btn-danger" disabled={doRefund.isPending} onClick={() => window.confirm(refund ? `Refund $${refund}?` : 'Refund the full remaining amount?') && doRefund.mutate()}>{refund ? 'Partial refund' : 'Full refund'}</button><span className="text-xs text-muted">Leave blank to refund everything remaining. Full refunds of unshipped orders restock items.</span></div>
      )}
    </div>
  );
}

function Orders() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Order | null>(null);
  const q = useQuery({ queryKey: ['admin-orders', page, status, search], queryFn: () => apiList<Order>(`/admin/orders?page=${page}&limit=15${status ? `&status=${status}` : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`) });
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Orders</h1>
        <div className="flex gap-2"><input className="input !w-52" type="search" placeholder="Order # or email" aria-label="Search orders" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="input !w-auto" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{['processing', 'shipped', 'delivered', 'cancelled'].map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}</select></div></div>
      {open && <OrderPanel o={open} onClose={() => setOpen(null)} />}
      {q.isLoading && <Skeleton className="h-64" />}{q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.items.length === 0 && <EmptyState title="No orders found" />}
      {q.data && q.data.items.length > 0 && <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Orders</caption><thead className="border-b border-line text-muted"><tr><th className="p-3">Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Fulfillment</th><th /></tr></thead>
        <tbody>{q.data.items.map((o) => <tr key={o._id} className="border-b border-line/50"><td className="p-3 font-mono">{o.orderNumber}</td><td>{o.email}</td><td>{date(o.createdAt)}</td><td>{money(o.total)}</td><td><span className="chip">{statusLabel[o.paymentStatus]}</span></td><td><span className="chip">{statusLabel[o.fulfillmentStatus]}</span></td><td className="p-3 text-right"><button className="underline" onClick={() => setOpen(o)}>Manage</button></td></tr>)}</tbody></table></div>}
      {q.data && q.data.meta.pages > 1 && <div className="mt-4 flex items-center justify-center gap-3"><button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="text-sm text-muted">Page {page} of {q.data.meta.pages}</span><button className="btn-ghost" disabled={page >= q.data.meta.pages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </div>
  );
}

interface U { _id: string; name: string; email: string; role: 'customer' | 'admin'; isActive: boolean; emailVerified: boolean; createdAt: string }
function Users() {
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['admin-users', page, search], queryFn: () => apiList<U>(`/admin/users?page=${page}&limit=20${search ? `&q=${encodeURIComponent(search)}` : ''}`) });
  const upd = useMutation({ mutationFn: (v: { id: string; body: Partial<Pick<U, 'role' | 'isActive'>> }) => api(`/admin/users/${v.id}`, { method: 'PATCH', body: v.body }), onSuccess: () => { toast.success('User updated.'); qc.invalidateQueries({ queryKey: ['admin-users'] }); }, onError: (e) => toast.error((e as Error).message) });
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Users</h1><input className="input !w-60" type="search" placeholder="Search name or email" aria-label="Search users" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
      {q.isLoading && <Skeleton className="h-64" />}{q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Users</caption><thead className="border-b border-line text-muted"><tr><th className="p-3">User</th><th>Role</th><th>Status</th><th>Joined</th><th className="p-3 text-right">Actions</th></tr></thead>
        <tbody>{q.data.items.map((u) => <tr key={u._id} className="border-b border-line/50"><td className="p-3"><b>{u.name}</b><div className="text-xs text-muted">{u.email}{u.emailVerified ? '' : ' (unverified)'}</div></td><td>{u.role}</td><td>{u.isActive ? 'Active' : 'Disabled'}</td><td>{date(u.createdAt)}</td>
          <td className="p-3 text-right">{u._id !== me?.id && <><button className="mr-3 underline" onClick={() => upd.mutate({ id: u._id, body: { role: u.role === 'admin' ? 'customer' : 'admin' } })}>{u.role === 'admin' ? 'Make customer' : 'Make admin'}</button><button className="text-danger underline" onClick={() => upd.mutate({ id: u._id, body: { isActive: !u.isActive } })}>{u.isActive ? 'Disable' : 'Enable'}</button></>}</td></tr>)}</tbody></table></div>}
      {q.data && q.data.meta.pages > 1 && <div className="mt-4 flex items-center justify-center gap-3"><button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="text-sm text-muted">Page {page} of {q.data.meta.pages}</span><button className="btn-ghost" disabled={page >= q.data.meta.pages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </div>
  );
}

export default function AdminOrders({ tab }: { tab: 'orders' | 'users' }) {
  return tab === 'orders' ? <Orders /> : <Users />;
}
