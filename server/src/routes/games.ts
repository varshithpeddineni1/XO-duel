// Thin HTTP layer — parse/validate, delegate to the service, map the response. No business
// logic here (ARC-2).
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createGameSchema, gameIdParamSchema, makeMoveSchema } from '../schemas/gameSchemas.js';
import { createGame, getGame, submitMove } from '../services/gameService.js';

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

// Game-creation is rate-limited to prevent spam room creation (API-10). Skipped in the
// integration test process, where every request shares one loopback IP — otherwise the
// test suite's own game-creation volume would trip it.
const createGameLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

export const gamesRouter = Router();

gamesRouter.post(
  '/',
  createGameLimiter,
  asyncHandler(async (req, res) => {
    const input = createGameSchema.parse(req.body);
    const game = await createGame(input);
    res.status(201).json(game);
  }),
);

gamesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = gameIdParamSchema.parse(req.params.id);
    const game = await getGame(id);
    res.status(200).json(game);
  }),
);

gamesRouter.post(
  '/:id/moves',
  asyncHandler(async (req, res) => {
    const id = gameIdParamSchema.parse(req.params.id);
    const { cell, mark } = makeMoveSchema.parse(req.body);
    const game = await submitMove(id, cell, mark);
    res.status(200).json(game);
  }),
);
