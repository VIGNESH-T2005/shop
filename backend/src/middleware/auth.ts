import { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError';
import { ACCESS_COOKIE } from '../utils/cookies';
import { Role, verifyAccess } from '../utils/tokens';

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return next(new ApiError(401, 'Please sign in to continue.', 'UNAUTHENTICATED'));
  try {
    const p = verifyAccess(token);
    req.user = { id: p.sub, role: p.role };
    next();
  } catch {
    next(new ApiError(401, 'Your session has expired. Please sign in again.', 'TOKEN_EXPIRED'));
  }
};

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (token) {
    try {
      const p = verifyAccess(token);
      req.user = { id: p.sub, role: p.role };
    } catch {
      /* treated as guest */
    }
  }
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Please sign in to continue.', 'UNAUTHENTICATED'));
    if (!roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have access to this resource.', 'FORBIDDEN'));
    next();
  };
