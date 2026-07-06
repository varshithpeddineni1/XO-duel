// Minimal bootstrap so `npm run dev --workspace server` and the CI/e2e gate have something
// real to run against. Deliberately just a health check — no game routes, no Socket.io yet
// (Phase 2+). Business logic belongs in src/services, not here (ARC-2).
import express from 'express';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

export function createApp() {
  const app = express();

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

/* c8 ignore start -- process bootstrap, not exercised by unit tests */
if (process.env.VITEST === undefined) {
  const app = createApp();
  app.listen(env.port, () => {
    logger.info('server started', { port: env.port });
  });
}
/* c8 ignore stop */
