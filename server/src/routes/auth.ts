// Optional account upgrade on top of a guest session (SEC-3) — argon2-backed (SEC-1).
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { destroySession, regenerateSession } from '../lib/sessionHelpers.js';
import { loginSchema, registerSchema } from '../schemas/authSchemas.js';
import { getOrCreatePlayer, loginAccount, registerAccount } from '../services/playerService.js';

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

// Credential-stuffing resistance (API-10) — tighter than game creation's limiter, and
// register tighter still since account creation should be rarer than login attempts.
const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter = Router();

authRouter.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = registerSchema.parse(req.body);
    const player = await getOrCreatePlayer(req.session.playerId ?? null);
    const registered = await registerAccount(player.id, username, password);
    req.session.playerId = registered.id;
    res.status(200).json(registered);
  }),
);

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const player = await loginAccount(username, password);
    // Regenerate the session id on login (not just swap playerId) to prevent session
    // fixation — an attacker who fixed this browser's session id before login shouldn't
    // gain a valid session to the account afterward.
    await regenerateSession(req);
    req.session.playerId = player.id;
    res.status(200).json(player);
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await destroySession(req);
    res.status(204).end();
  }),
);
