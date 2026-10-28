import { CookieOptions, Response } from 'express';
import { isProd } from '../config/env';
import { ACCESS_TTL_SEC, REFRESH_TTL_SEC } from './tokens';

export const ACCESS_COOKIE = 'sz_at';
export const REFRESH_COOKIE = 'sz_rt';

// Frontend (Vercel) and API (Render) are on different sites in production, so cookies need SameSite=None; Secure.
const base: CookieOptions = { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax' };

export function setAuthCookies(res: Response, access: string, refresh: string) {
  res.cookie(ACCESS_COOKIE, access, { ...base, path: '/', maxAge: ACCESS_TTL_SEC * 1000 });
  res.cookie(REFRESH_COOKIE, refresh, { ...base, path: '/api/auth', maxAge: REFRESH_TTL_SEC * 1000 });
}
export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/auth' });
}
