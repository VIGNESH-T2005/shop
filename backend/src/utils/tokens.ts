import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type Role = 'customer' | 'admin';
export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

export const signAccess = (sub: string, role: Role) =>
  jwt.sign({ role }, env.JWT_ACCESS_SECRET, { subject: sub, expiresIn: ACCESS_TTL_SEC });
export const signRefresh = (sub: string, jti: string) =>
  jwt.sign({}, env.JWT_REFRESH_SECRET, { subject: sub, jwtid: jti, expiresIn: REFRESH_TTL_SEC });

export const verifyAccess = (t: string) => {
  const p = jwt.verify(t, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  return { sub: String(p.sub), role: p.role as Role };
};
export const verifyRefresh = (t: string) => {
  const p = jwt.verify(t, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  return { sub: String(p.sub), jti: String(p.jti) };
};

export const randomToken = () => crypto.randomBytes(32).toString('hex');
export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
