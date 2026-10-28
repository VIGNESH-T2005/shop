import { RequestHandler } from 'express';
import { ZodTypeAny } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}
export const validate =
  (s: Schemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (s.params) req.params = s.params.parse(req.params);
      if (s.query) (req as any).query = s.query.parse(req.query);
      if (s.body) req.body = s.body.parse(req.body);
      next();
    } catch (e) {
      next(e);
    }
  };
