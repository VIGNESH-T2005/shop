import { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { isProd, isTest } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export const notFound: RequestHandler = (req, _res, next) =>
  next(new ApiError(404, `Route not found: ${req.method} ${req.path}`, 'NOT_FOUND'));

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side.';
  let details: unknown;

  if (err instanceof ApiError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Please check the highlighted fields.';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'BAD_ID';
    message = 'Invalid identifier.';
  } else if (err?.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = `That ${Object.keys(err.keyPattern ?? {})[0] ?? 'value'} is already in use.`;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'BAD_JSON';
    message = 'Request body is not valid JSON.';
  } else if (err?.name === 'MulterError') {
    status = 400;
    code = 'UPLOAD_ERROR';
    message = err.message;
  }

  if (status >= 500 && !isTest) logger.error(err?.message, isProd ? '' : err?.stack);
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
};
