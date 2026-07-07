// Central error-mapping middleware — every route delegates errors here via `next(err)`
// (or Express 5's automatic async-error forwarding) so response shape stays consistent
// and internals never leak (API-3, CODE-6).
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { GameNotFoundError, GameNotInProgressError, IllegalMoveError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues.map((issue) => issue.message).join('; '),
      },
    });
    return;
  }

  if (err instanceof GameNotFoundError) {
    res.status(404).json({ error: { code: 'GAME_NOT_FOUND', message: err.message } });
    return;
  }

  if (err instanceof GameNotInProgressError) {
    res.status(409).json({ error: { code: 'GAME_NOT_IN_PROGRESS', message: err.message } });
    return;
  }

  if (err instanceof IllegalMoveError) {
    res.status(400).json({ error: { code: 'ILLEGAL_MOVE', message: err.message } });
    return;
  }

  logger.error('unhandled request error', {
    message: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
};
