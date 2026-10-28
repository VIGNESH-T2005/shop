import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { toast } from '../store/ui';
import type { User } from '../types';

declare global { interface Window { google?: any } }

function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
}

export function GoogleButton({ redirectTo = '/', text = 'continue_with' }: { redirectTo?: string; text?: 'signin_with' | 'signup_with' | 'continue_with' }) {
  const { data } = useQuery({ queryKey: ['auth-config'], queryFn: () => api<{ googleEnabled: boolean; googleClientId: string | null }>('/auth/config'), staleTime: Infinity });
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const setUser = useAuth((s) => s.setUser);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!data?.googleEnabled || !data.googleClientId) return;
    let dead = false;
    loadGsi()
      .then(() => {
        if (dead || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: data.googleClientId,
          callback: async (resp: { credential: string }) => {
            try {
              const r = await api<{ user: User }>('/auth/google', { method: 'POST', body: { credential: resp.credential } });
              setUser(r.user);
              nav(redirectTo, { replace: true });
            } catch (e) {
              toast.error((e as Error).message);
            }
          },
        });
        window.google.accounts.id.renderButton(ref.current, { theme: 'filled_black', size: 'large', text, shape: 'pill', width: Math.min(360, ref.current.offsetWidth || 320) });
      })
      .catch(() => setLoadError(true));
    return () => { dead = true; };
  }, [data, nav, redirectTo, setUser, text]);

  if (!data) return <div className="skeleton h-11 w-full" aria-hidden />;
  if (!data.googleEnabled) {
    return (
      <div className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted" role="note">
        <b className="text-ink">Google sign-in: setup required.</b> Add <code>GOOGLE_CLIENT_ID</code> to the server environment to enable it.
      </div>
    );
  }
  if (loadError) return <p className="text-center text-xs text-danger" role="alert">Google sign-in could not load. Check your connection or ad blocker.</p>;
  return <div ref={ref} className="flex min-h-[44px] justify-center" />;
}
