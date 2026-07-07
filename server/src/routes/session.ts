// Guest session bootstrap — no login required for any mode (API-7). The client calls
// POST /api/session once on first load; every request after that carries the session
// cookie, identifying a guest (or, once registered, an account) without any credentials.
import { Router, type NextFunction, type Request, type Response } from 'express';
import { getOrCreatePlayer, getPlayerById, getPlayerStats } from '../services/playerService.js';

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export const sessionRouter = Router();

sessionRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const player = await getOrCreatePlayer(req.session.playerId ?? null);
    req.session.playerId = player.id;
    res.status(200).json(player);
  }),
);

export const meRouter = Router();

meRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.session.playerId) {
      res.status(200).json(null);
      return;
    }
    const player = await getPlayerById(req.session.playerId);
    if (!player) {
      res.status(200).json(null);
      return;
    }
    const stats = player.isRegistered ? await getPlayerStats(player.id) : null;
    res.status(200).json({ ...player, stats });
  }),
);
