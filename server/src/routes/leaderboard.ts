// Thin HTTP layer — parse/validate, delegate to the service, map the response (ARC-2).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { getGlobalLeaderboard } from '../services/leaderboardService.js';

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export const leaderboardRouter = Router();

leaderboardRouter.get(
  '/global',
  asyncHandler(async (_req, res) => {
    const leaderboard = await getGlobalLeaderboard();
    res.status(200).json(leaderboard);
  }),
);
