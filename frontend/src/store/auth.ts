import { create } from 'zustand';
import { api } from '../lib/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  status: 'loading' | 'ready';
  bootstrap: () => Promise<void>;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}
export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  setUser: (user) => set({ user, status: 'ready' }),
  bootstrap: async () => {
    try {
      const r = await api<{ user: User }>('/auth/me');
      set({ user: r.user, status: 'ready' });
    } catch {
      set({ user: null, status: 'ready' });
    }
  },
  logout: async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    set({ user: null });
  },
}));
