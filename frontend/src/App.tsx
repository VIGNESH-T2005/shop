import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Skeleton } from './components/Skeleton';
import { useSessionSync } from './hooks/useSessionSync';
import { useAuth } from './store/auth';

const Home = lazy(() => import('./pages/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Account = lazy(() => import('./pages/Account'));
const Orders = lazy(() => import('./pages/Orders'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AuthPages = lazy(() => import('./pages/Auth'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminCatalog = lazy(() => import('./pages/admin/AdminCatalog'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));

const Fallback = () => (
  <div className="container-x py-16" role="status" aria-label="Loading">
    <Skeleton className="h-10 w-1/3" />
    <Skeleton className="mt-6 h-72 w-full" />
  </div>
);

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => { void bootstrap(); }, [bootstrap]);
  useSessionSync();
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="product/:slug" element={<ProductPage />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="checkout/success" element={<CheckoutSuccess />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="login" element={<AuthPages mode="login" />} />
          <Route path="register" element={<AuthPages mode="register" />} />
          <Route path="forgot-password" element={<AuthPages mode="forgot" />} />
          <Route path="reset-password" element={<AuthPages mode="reset" />} />
          <Route path="verify-email" element={<AuthPages mode="verify" />} />
          <Route element={<ProtectedRoute />}>
            <Route path="account" element={<Account />} />
            <Route path="orders/:id" element={<Orders mode="detail" />} />
            <Route path="orders/:id/invoice" element={<Orders mode="invoice" />} />
          </Route>
          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminCatalog tab="products" />} />
              <Route path="categories" element={<AdminCatalog tab="categories" />} />
              <Route path="coupons" element={<AdminCatalog tab="coupons" />} />
              <Route path="orders" element={<AdminOrders tab="orders" />} />
              <Route path="users" element={<AdminOrders tab="users" />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
