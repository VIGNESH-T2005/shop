import { NavLink, Outlet } from 'react-router-dom';

const items = [['/admin', 'Overview', true], ['/admin/products', 'Products'], ['/admin/categories', 'Categories'], ['/admin/coupons', 'Coupons'], ['/admin/orders', 'Orders'], ['/admin/users', 'Users']] as const;
export default function AdminLayout() {
  return (
    <div className="container-x py-8">
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
          {items.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={!!end} className={({ isActive }) => `whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${isActive ? 'bg-brass text-bg' : 'text-muted hover:bg-raised hover:text-ink'}`}>{label}</NavLink>
          ))}
        </nav>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </div>
  );
}
