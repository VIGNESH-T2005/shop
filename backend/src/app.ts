import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import { env } from './config/env';
import { stripeWebhook } from './controllers/webhook.controller';
import { errorHandler, notFound } from './middleware/error';
import { csrfGuard, globalLimiter } from './middleware/security';
import routes from './routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render sits behind a proxy
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'X-Requested-With'] }));

  // Stripe needs the raw body, so this route is registered before express.json().
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

  app.use(globalLimiter);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(mongoSanitize()); // strips $ and . operators from body/query/params
  app.use('/api', csrfGuard, routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
