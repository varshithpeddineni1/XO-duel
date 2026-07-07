// Guards every /api/admin/* route except login itself (SEC-2, SEC-10). Frontend admin
// checks are UX only — this is the actual enforcement point.
import type { NextFunction, Request, Response } from 'express';
import { AdminAuthRequiredError } from '../lib/errors.js';

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session.isAdmin) {
    next(new AdminAuthRequiredError());
    return;
  }
  next();
}
