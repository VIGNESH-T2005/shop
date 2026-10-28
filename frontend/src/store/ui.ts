import { create } from 'zustand';

export interface Toast { id: number; message: string; kind: 'success' | 'error' | 'info' }
interface UI { toasts: Toast[]; push: (message: string, kind?: Toast['kind']) => void; dismiss: (id: number) => void }
let n = 0;
export const useUI = create<UI>((set) => ({
  toasts: [],
  push: (message, kind = 'info') => {
    const id = ++n;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
export const toast = {
  success: (m: string) => useUI.getState().push(m, 'success'),
  error: (m: string) => useUI.getState().push(m, 'error'),
  info: (m: string) => useUI.getState().push(m, 'info'),
};
