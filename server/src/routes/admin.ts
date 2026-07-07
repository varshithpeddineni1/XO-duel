// Real admin auth (SEC-2) — replaces the mockup's hardcoded client-side check entirely.
// Read-only in v1 (SEC-10): no mutation routes exist here on purpose.
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { destroySession, regenerateSession } from '../lib/sessionHelpers.js';
import { InvalidCredentialsError } from '../lib/errors.js';
import { adminLoginSchema, adminPlayersQuerySchema } from '../schemas/adminSchemas.js';
import { getAdminStats, listPlayers, verifyAdminCredentials } from '../services/adminService.js';

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

// Same rationale as player login (API-10, credential-stuffing) — arguably even more
// sensitive, since this is the one account with visibility into every player's data.
const adminLoginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminRouter = Router();

adminRouter.post(
  '/login',
  adminLoginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = adminLoginSchema.parse(req.body);
    const valid = await verifyAdminCredentials(username, password);
    if (!valid) throw new InvalidCredentialsError();

    await regenerateSession(req); // session fixation defense, same as player login
    req.session.isAdmin = true;
    res.status(200).json({ isAdmin: true });
  }),
);

adminRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await destroySession(req);
    res.status(204).end();
  }),
);

adminRouter.get(
  '/stats',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.status(200).json(await getAdminStats());
  }),
);

adminRouter.get(
  '/players',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { limit, offset } = adminPlayersQuerySchema.parse(req.query);
    res.status(200).json(await listPlayers(limit, offset));
  }),
);
