import { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';
import { ApiError } from '../utils/ApiError';

const limiter = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    handler: (_req, _res, next) => next(new ApiError(429, message, 'RATE_LIMITED')),
  });

export const globalLimiter = limiter(15 * 60 * 1000, 600, 'Too many requests. Please slow down.');
export const authLimiter = limiter(15 * 60 * 1000, 30, 'Too many attempts. Try again in a few minutes.');
export const paymentLimiter = limiter(15 * 60 * 1000, 40, 'Too many payment requests. Try again shortly.');

/**
 * Cookies are SameSite=None in production, so state-changing requests must carry a custom header.
 * Browsers only allow that header cross-origin after a CORS preflight, which only our CLIENT_URL passes.
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path.startsWith('/webhooks/')) return next();
  if (req.get('x-requested-with') !== 'shop-zone') return next(new ApiError(403, 'Missing request header.', 'CSRF'));
  next();
};
