import type { Meta } from '../types';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'ERROR', public details?: { path: string; message: string }[]) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;
/** Single-flight refresh: parallel 401s share one rotation, otherwise reuse detection would log the user out. */
function refreshSession() {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'shop-zone' } })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

interface Opts { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal }

async function request(path: string, opts: Opts = {}, retried = false): Promise<{ data: any; meta?: Meta }> {
  const headers: Record<string, string> = { 'X-Requested-With': 'shop-zone' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'include',
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', 'NETWORK');
  }
  const json = await res.json().catch(() => null);
  if (res.ok && json?.success) return { data: json.data, meta: json.meta };
  const err = json?.error;
  if (res.status === 401 && !retried && !path.startsWith('/auth/') && (await refreshSession())) return request(path, opts, true);
  throw new ApiError(res.status, err?.message ?? `Request failed (${res.status})`, err?.code, err?.details);
}

export const api = async <T = any>(path: string, opts?: Opts): Promise<T> => (await request(path, opts)).data as T;
export const apiList = async <T = any>(path: string, opts?: Opts) => {
  const r = await request(path, opts);
  return { items: r.data as T[], meta: r.meta as Meta };
};

export const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && u.set(k, String(v)));
  const s = u.toString();
  return s ? `?${s}` : '';
};
