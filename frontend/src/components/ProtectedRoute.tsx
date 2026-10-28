import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { Skeleton } from './Skeleton';

export function ProtectedRoute({ role }: { role?: 'admin' }) {
  const { user, status } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <div className="container-x py-16"><Skeleton className="h-64 w-full" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
