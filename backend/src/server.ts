import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { logger } from './utils/logger';

async function main() {
  await connectDB();
  const app = createApp();
  app.listen(env.PORT, () => logger.info(`API listening on :${env.PORT} (${env.NODE_ENV})`));
}
main().catch((e) => {
  logger.error('Failed to start:', e.message);
  process.exit(1);
});
