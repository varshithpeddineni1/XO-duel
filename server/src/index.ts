// Express app bootstrap. Thin — route/business logic lives in src/routes and src/services
// (ARC-2). Server is the sole authority on game state (ARC-5): every mutation goes through
// gameService, never trusting client-submitted board state.
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { openApiDocument } from './openapi.js';
import { gamesRouter } from './routes/games.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Browsable API reference in development (API-1).
  if (env.nodeEnv !== 'production') {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  }

  app.use('/api/games', gamesRouter);

  app.use(errorHandler);

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
