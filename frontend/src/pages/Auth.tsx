import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ReactNode, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Field } from '../components/Field';
import { GoogleButton } from '../components/GoogleButton';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../store/auth';
import { toast } from '../store/ui';
import type { User } from '../types';

const email = z.string().trim().toLowerCase().email('Enter a valid email');
const password = z.string().min(8, 'Use at least 8 characters').max(72).regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');
type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

function Shell({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-12">
      <div className="card w-full max-w-md p-7 sm:p-9">
        <h1 className="text-3xl font-bold">{title}</h1>
        {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
const Divider = () => <div className="my-5 flex items-center gap-3 text-xs text-muted" aria-hidden><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>;
const useRedirect = () => { const loc = useLocation(); return ((loc.state as { from?: string } | null)?.from) || '/'; };

function SignIn({ register: isRegister }: { register?: boolean }) {
  const nav = useNavigate();
  const to = useRedirect();
  const setUser = useAuth((s) => s.setUser);
  const schema = isRegister ? z.object({ name: z.string().trim().min(2, 'Enter your name'), email, password }) : z.object({ email, password: z.string().min(1, 'Enter your password') });
  const { register, handleSubmit, setError, formState: { errors } } = useForm<{ name?: string; email: string; password: string }>({ resolver: zodResolver(schema as any) });
  const m = useMutation({
    mutationFn: (v: { name?: string; email: string; password: string }) => api<{ user: User }>(isRegister ? '/auth/register' : '/auth/login', { method: 'POST', body: v }),
    onSuccess: (r) => { setUser(r.user); if (isRegister) toast.success('Account created. Check your email to verify it.'); nav(to, { replace: true }); },
    onError: (e) => {
      if (e instanceof ApiError && e.details) e.details.forEach((d) => setError(d.path as 'email', { message: d.message }));
      else setError('root' as any, { message: (e as Error).message });
    },
  });
  const rootErr = (errors as any).root?.message as string | undefined;
  return (
    <Shell title={isRegister ? 'Create your account' : 'Welcome back'} sub={isRegister ? <>Already have one? <Link to="/login" state={{ from: to }} className="text-brass underline">Sign in</Link></> : <>New here? <Link to="/register" state={{ from: to }} className="text-brass underline">Create an account</Link></>}>
      <GoogleButton redirectTo={to} text={isRegister ? 'signup_with' : 'signin_with'} />
      <Divider />
      <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-4" noValidate>
        {isRegister && <Field label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />}
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Field label="Password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} hint={isRegister ? '8+ characters with a letter and a number' : undefined} error={errors.password?.message} {...register('password')} />
        {rootErr && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{rootErr}</p>}
        <button className="btn-primary w-full !py-3" disabled={m.isPending}>{m.isPending ? 'One moment…' : isRegister ? 'Create account' : 'Sign in'}</button>
        {!isRegister && <p className="text-center text-sm"><Link to="/forgot-password" className="text-muted underline hover:text-ink">Forgot your password?</Link></p>}
      </form>
    </Shell>
  );
}

function Forgot() {
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email })) });
  const m = useMutation({ mutationFn: (v: { email: string }) => api('/auth/forgot-password', { method: 'POST', body: v }), onError: (e) => toast.error((e as Error).message) });
  return (
    <Shell title="Reset your password" sub="We’ll email you a link that works for one hour.">
      {m.isSuccess ? <p role="status" className="rounded-lg border border-ok/40 bg-ok/10 p-4 text-sm">If that email has an account, a reset link is on its way. <Link to="/login" className="underline">Back to sign in</Link></p> : (
        <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-4" noValidate>
          <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <button className="btn-primary w-full !py-3" disabled={m.isPending}>{m.isPending ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </Shell>
  );
}

function Reset() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const token = sp.get('token') ?? '';
  const { register, handleSubmit, formState: { errors } } = useForm<{ password: string }>({ resolver: zodResolver(z.object({ password })) });
  const m = useMutation({
    mutationFn: (v: { password: string }) => api('/auth/reset-password', { method: 'POST', body: { token, password: v.password } }),
    onSuccess: () => { toast.success('Password updated. Sign in with your new password.'); nav('/login', { replace: true }); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!token) return <Shell title="Link not valid" sub="This reset link is incomplete."><Link to="/forgot-password" className="btn-primary w-full">Request a new link</Link></Shell>;
  return (
    <Shell title="Choose a new password">
      <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-4" noValidate>
        <Field label="New password" type="password" autoComplete="new-password" hint="8+ characters with a letter and a number" error={errors.password?.message} {...register('password')} />
        <button className="btn-primary w-full !py-3" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Update password'}</button>
      </form>
    </Shell>
  );
}

function Verify() {
  const [sp] = useSearchParams();
  const token = sp.get('token') ?? '';
  const user = useAuth((s) => s.user);
  const fired = useRef(false);
  const m = useMutation({ mutationFn: () => api('/auth/verify-email', { method: 'POST', body: { token } }), onSuccess: () => useAuth.getState().bootstrap() });
  useEffect(() => { if (token && !fired.current) { fired.current = true; m.mutate(); } }, [token]); // eslint-disable-line
  return (
    <Shell title={m.isSuccess ? 'Email verified' : m.isError ? 'Link not valid' : 'Verifying your email…'}>
      {m.isPending && <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-brass" role="status" aria-label="Verifying" />}
      {m.isSuccess && <><p className="text-sm text-muted">You’re all set.</p><Link to="/shop" className="btn-primary mt-5 w-full">Start shopping</Link></>}
      {m.isError && <><p role="alert" className="text-sm text-danger">{(m.error as Error).message}</p>{user ? <button className="btn-primary mt-5 w-full" onClick={() => api('/auth/resend-verification', { method: 'POST' }).then(() => toast.success('Verification email sent.')).catch((e) => toast.error(e.message))}>Send a new link</button> : <Link to="/login" className="btn-primary mt-5 w-full">Sign in to request a new link</Link>}</>}
      {!token && <p className="text-sm text-muted">This link is incomplete.</p>}
    </Shell>
  );
}

export default function AuthPages({ mode }: { mode: Mode }) {
  const user = useAuth((s) => s.user);
  const nav = useNavigate();
  const to = useRedirect();
  useEffect(() => { if (user && (mode === 'login' || mode === 'register')) nav(to, { replace: true }); }, [user, mode, nav, to]);
  if (mode === 'login') return <SignIn />;
  if (mode === 'register') return <SignIn register />;
  if (mode === 'forgot') return <Forgot />;
  if (mode === 'reset') return <Reset />;
  return <Verify />;
}
