import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Field } from '../components/Field';
import { EmptyState, ErrorState } from '../components/StateViews';
import { Skeleton } from '../components/Skeleton';
import { api, apiList } from '../lib/api';
import { date, money, statusLabel } from '../lib/format';
import { useAuth } from '../store/auth';
import { toast } from '../store/ui';
import type { Address, Order, User } from '../types';

const tabs = ['Orders', 'Addresses', 'Security', 'Profile'] as const;

function OrdersTab() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['my-orders', page], queryFn: () => apiList<Order>(`/orders?page=${page}`) });
  if (q.isLoading) return <Skeleton className="h-40" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data?.items.length) return <EmptyState title="No orders yet" body="When you place an order it will show up here." cta={{ to: '/shop', label: 'Start shopping' }} />;
  return (
    <div>
      <ul className="space-y-3">
        {q.data.items.map((o) => (
          <li key={o._id}><Link to={`/orders/${o._id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-brass/60">
            <div><p className="font-semibold">{o.orderNumber}</p><p className="text-sm text-muted">{date(o.createdAt)} · {o.items.reduce((n, i) => n + i.qty, 0)} items</p></div>
            <div className="text-right"><p className="font-semibold">{money(o.total)}</p><span className="chip">{statusLabel[o.fulfillmentStatus]}</span></div>
          </Link></li>
        ))}
      </ul>
      {q.data.meta.pages > 1 && <div className="mt-6 flex justify-center gap-2"><button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</button><button className="btn-ghost" disabled={page >= q.data.meta.pages} onClick={() => setPage(page + 1)}>Older</button></div>}
    </div>
  );
}

const addrSchema = z.object({
  label: z.string().trim().max(40).optional(), fullName: z.string().trim().min(2, 'Enter a name'), line1: z.string().trim().min(3, 'Enter an address'), line2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'Enter a city'), state: z.string().trim().min(1, 'Required'), postalCode: z.string().trim().min(3, 'Required'), country: z.string().length(2).default('US'), phone: z.string().trim().optional(), isDefault: z.boolean().optional(),
});
function AddressesTab() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const [adding, setAdding] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Address>({ resolver: zodResolver(addrSchema) as any, defaultValues: { country: 'US' } });
  const save = useMutation({
    mutationFn: (v: Address) => api<{ addresses: Address[] }>('/account/addresses', { method: 'POST', body: v }),
    onSuccess: (r) => { setUser({ ...user, addresses: r.addresses }); setAdding(false); reset(); toast.success('Address saved.'); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (id: string) => api<{ addresses: Address[] }>(`/account/addresses/${id}`, { method: 'DELETE' }),
    onSuccess: (r) => { setUser({ ...user, addresses: r.addresses }); toast.success('Address removed.'); },
  });
  const makeDefault = useMutation({
    mutationFn: (id: string) => api<{ addresses: Address[] }>(`/account/addresses/${id}`, { method: 'PUT', body: { isDefault: true } }),
    onSuccess: (r) => setUser({ ...user, addresses: r.addresses }),
  });
  return (
    <div className="space-y-4">
      {user.addresses.length === 0 && !adding && <EmptyState title="No saved addresses" body="Save one to speed up checkout." />}
      <div className="grid gap-3 sm:grid-cols-2">
        {user.addresses.map((a) => (
          <div key={a._id} className="card p-4 text-sm">
            <p className="font-semibold">{a.label || a.fullName} {a.isDefault && <span className="chip ml-1">Default</span>}</p>
            <p className="mt-1 text-muted">{a.fullName}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} {a.postalCode}, {a.country}</p>
            <div className="mt-3 flex gap-3 text-xs">{!a.isDefault && <button className="underline" onClick={() => makeDefault.mutate(a._id!)}>Make default</button>}<button className="text-danger underline" onClick={() => del.mutate(a._id!)}>Remove</button></div>
          </div>
        ))}
      </div>
      {adding ? (
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="card grid gap-4 p-5 sm:grid-cols-2" noValidate>
          <Field label="Label (Home, Work)" {...register('label')} /><Field label="Full name" error={errors.fullName?.message} {...register('fullName')} />
          <Field className="sm:col-span-2" label="Address" error={errors.line1?.message} {...register('line1')} /><Field className="sm:col-span-2" label="Apartment, suite (optional)" {...register('line2')} />
          <Field label="City" error={errors.city?.message} {...register('city')} /><Field label="State / region" error={errors.state?.message} {...register('state')} />
          <Field label="Postal code" error={errors.postalCode?.message} {...register('postalCode')} /><Field label="Country (2-letter code)" maxLength={2} {...register('country')} />
          <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button><button className="btn-primary" disabled={save.isPending}>Save address</button></div>
        </form>
      ) : <button className="btn-ghost" onClick={() => setAdding(true)}>Add an address</button>}
    </div>
  );
}

function SecurityTab() {
  const user = useAuth((s) => s.user)!;
  const schema = z.object({ currentPassword: user.hasPassword ? z.string().min(1, 'Enter your current password') : z.string().optional(), newPassword: z.string().min(8, 'Use at least 8 characters').max(72).regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number') });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ currentPassword?: string; newPassword: string }>({ resolver: zodResolver(schema) });
  const m = useMutation({
    mutationFn: (v: { currentPassword?: string; newPassword: string }) => api('/account/password', { method: 'POST', body: { ...v, currentPassword: v.currentPassword || undefined } }),
    onSuccess: () => { toast.success('Password updated. Other devices were signed out.'); reset(); useAuth.getState().bootstrap(); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} className="card max-w-md space-y-4 p-6" noValidate>
      <h2 className="font-sans text-lg font-bold">{user.hasPassword ? 'Change password' : 'Add a password'}</h2>
      {!user.hasPassword && <p className="text-sm text-muted">You signed up with Google. Adding a password lets you also sign in with your email.</p>}
      {user.hasPassword && <Field label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />}
      <Field label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
      <button className="btn-primary" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Update password'}</button>
    </form>
  );
}

function ProfileTab() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<{ name: string }>({ resolver: zodResolver(z.object({ name: z.string().trim().min(2, 'Enter your name') })), defaultValues: { name: user.name } });
  const m = useMutation({ mutationFn: (v: { name: string }) => api<{ user: User }>('/account/profile', { method: 'PATCH', body: v }), onSuccess: (r) => { setUser({ ...user, name: r.user.name }); qc.invalidateQueries(); toast.success('Profile updated.'); } });
  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} className="card max-w-md space-y-4 p-6" noValidate>
      <Field label="Name" error={errors.name?.message} {...register('name')} />
      <Field label="Email" value={user.email} disabled readOnly hint={user.emailVerified ? 'Verified' : 'Not verified yet'} />
      <button className="btn-primary" disabled={m.isPending}>Save changes</button>
    </form>
  );
}

export default function Account() {
  const user = useAuth((s) => s.user)!;
  const [tab, setTab] = useState<(typeof tabs)[number]>('Orders');
  return (
    <div className="container-x py-10">
      <h1 className="text-4xl font-bold">Hi, {user.name.split(' ')[0]}</h1>
      {!user.emailVerified && (
        <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass/40 bg-brass/10 p-4 text-sm">
          <span>Verify your email to secure your account.</span>
          <button className="btn-ghost !py-1.5" onClick={() => api('/auth/resend-verification', { method: 'POST' }).then(() => toast.success('Verification email sent.')).catch((e) => toast.error(e.message))}>Resend email</button>
        </div>
      )}
      <div role="tablist" aria-label="Account sections" className="mt-8 flex gap-2 overflow-x-auto border-b border-line">
        {tabs.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === t ? 'border-brass text-ink' : 'border-transparent text-muted'}`}>{t}</button>)}
      </div>
      <div className="mt-8" role="tabpanel">
        {tab === 'Orders' && <OrdersTab />}{tab === 'Addresses' && <AddressesTab />}{tab === 'Security' && <SecurityTab />}{tab === 'Profile' && <ProfileTab />}
      </div>
    </div>
  );
}
