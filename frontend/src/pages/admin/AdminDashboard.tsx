import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { ErrorState } from '../../components/StateViews';
import { Skeleton } from '../../components/Skeleton';
import { api } from '../../lib/api';
import { money } from '../../lib/format';

interface Stats {
  revenueByDay: { date: string; revenue: number; orders: number }[]; totalRevenue: number; totalOrders: number; customers: number; toFulfil: number;
  topProducts: { productId: string; title: string; units: number; revenue: number }[]; lowStock: { _id: string; title: string; slug: string; sku: string; stock: number }[];
}
const axis = { stroke: 'rgb(160 152 182)', fontSize: 12 };
const tip = { contentStyle: { background: 'rgb(34 30 50)', border: '1px solid rgb(56 50 78)', borderRadius: 12, color: '#eeeaf6' } };

export default function AdminDashboard() {
  const q = useQuery({ queryKey: ['admin-stats'], queryFn: () => api<Stats>('/admin/stats') });
  if (q.isLoading) return <div className="grid gap-4 sm:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-72 sm:col-span-4" /></div>;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  const kpis = [['Revenue (net of refunds)', money(s.totalRevenue)], ['Orders', String(s.totalOrders)], ['Customers', String(s.customers)], ['Waiting to ship', String(s.toFulfil)]];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Overview</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{kpis.map(([k, v]) => <div key={k} className="card p-5"><p className="text-sm text-muted">{k}</p><p className="mt-1 font-display text-3xl font-bold">{v}</p></div>)}</div>
      <section className="card p-5" aria-label="Revenue, last 30 days"><h2 className="mb-4 font-sans text-base font-semibold">Revenue, last 30 days</h2>
        {s.revenueByDay.length === 0 ? <p className="py-10 text-center text-sm text-muted">No paid orders in the last 30 days yet.</p> : (
          <div className="h-64"><ResponsiveContainer><LineChart data={s.revenueByDay.map((d) => ({ ...d, revenue: d.revenue / 100 }))}><CartesianGrid stroke="rgb(56 50 78)" strokeDasharray="3 3" /><XAxis dataKey="date" {...axis} tickFormatter={(d: string) => d.slice(5)} /><YAxis {...axis} tickFormatter={(v: number) => `$${v}`} /><Tooltip {...tip} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']} /><Line type="monotone" dataKey="revenue" stroke="rgb(242 184 75)" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div>
        )}</section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-label="Top products"><h2 className="mb-4 font-sans text-base font-semibold">Top products by units</h2>
          {s.topProducts.length === 0 ? <p className="py-8 text-center text-sm text-muted">Sales will appear here.</p> : (
            <div className="h-72"><ResponsiveContainer><BarChart data={s.topProducts} layout="vertical" margin={{ left: 20 }}><CartesianGrid stroke="rgb(56 50 78)" strokeDasharray="3 3" /><XAxis type="number" {...axis} allowDecimals={false} /><YAxis type="category" dataKey="title" width={130} {...axis} tickFormatter={(t: string) => (t.length > 18 ? `${t.slice(0, 17)}…` : t)} /><Tooltip {...tip} /><Bar dataKey="units" fill="rgb(183 148 246)" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>
          )}</section>
        <section className="card p-5" aria-label="Low stock"><h2 className="mb-4 font-sans text-base font-semibold">Low stock (5 or fewer)</h2>
          {s.lowStock.length === 0 ? <p className="py-8 text-center text-sm text-muted">Everything is well stocked.</p> : (
            <ul className="divide-y divide-line text-sm">{s.lowStock.map((l) => <li key={l._id + l.sku} className="flex items-center justify-between py-2.5"><Link to="/admin/products" className="hover:underline">{l.title} <span className="text-muted">({l.sku})</span></Link><span className={`chip ${l.stock === 0 ? '!border-danger !text-danger' : '!border-brass !text-brass'}`}>{l.stock === 0 ? 'Out' : `${l.stock} left`}</span></li>)}</ul>
          )}</section>
      </div>
    </div>
  );
}
