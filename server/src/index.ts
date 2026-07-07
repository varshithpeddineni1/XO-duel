// Express + Socket.io bootstrap. Thin — route/business logic lives in src/routes,
// src/services, and src/sockets (ARC-2). Server is the sole authority on game state
// (ARC-5): every mutation goes through gameService, never trusting a client-submitted
// board state, over REST or Socket.io alike.
import { createServer as createHttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server as SocketIoServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { createSessionMiddleware } from './middleware/session.js';
import { errorHandler } from './middleware/errorHandler.js';
import { openApiDocument } from './openapi.js';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import { meRouter, sessionRouter } from './routes/session.js';
import { registerGameSockets } from './sockets/gameSocket.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json());
  app.use(createSessionMiddleware());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Browsable API reference in development (API-1).
  if (env.nodeEnv !== 'production') {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  }

  app.use('/api/session', sessionRouter);
  app.use('/api/me', meRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/games', gamesRouter);

  app.use(errorHandler);

  return app;
}

// Wraps the Express app in a plain http.Server with Socket.io attached — used by the real
// bootstrap below and by socket integration tests, which need a real server to connect
// actual socket.io-client instances against (supertest, used for the REST-only tests,
// only needs the bare Express app from createApp()).
export function createServer() {
  const app = createApp();
  const httpServer = createHttpServer(app);
  const io = new SocketIoServer(httpServer, {
    cors: { origin: env.clientOrigin },
  });
  registerGameSockets(io);
  return { httpServer, io };
}

/* c8 ignore start -- process bootstrap, not exercised by unit tests */
if (process.env.VITEST === undefined) {
  const { httpServer } = createServer();
  httpServer.listen(env.port, () => {
    logger.info('server started', { port: env.port });
  });
}
/* c8 ignore stop */
