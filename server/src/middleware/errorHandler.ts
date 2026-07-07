// Central error-mapping middleware — every route delegates errors here via `next(err)`
// so response shape stays consistent and internals never leak (API-3, CODE-6).
import type { ErrorRequestHandler } from 'express';
import { toErrorResponse } from '../lib/errorResponse.js';
import { logger } from '../lib/logger.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const { status, code, message } = toErrorResponse(err);
  if (status === 500) {
    logger.error('unhandled request error', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
  res.status(status).json({ error: { code, message } });
};
