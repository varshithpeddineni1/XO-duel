// Thin HTTP layer — parse/validate, delegate to the service, map the response (ARC-2).
import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  friendInviteCodeParamSchema,
  friendRequestIdParamSchema,
  friendSearchQuerySchema,
  sendFriendRequestSchema,
} from '../schemas/friendSchemas.js';
import {
  acceptInviteLink,
  getFriendIds,
  listFriends,
  listPendingRequests,
  respondToFriendRequest,
  searchPlayers,
  sendFriendRequest,
} from '../services/friendService.js';
import { getFriendLeaderboard } from '../services/leaderboardService.js';
import { requireRegisteredPlayer } from '../services/playerService.js';

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export const friendsRouter = Router();

friendsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const player = await requireRegisteredPlayer(req.session.playerId);
    res.status(200).json(await listFriends(player.id));
  }),
);

friendsRouter.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const player = await requireRegisteredPlayer(req.session.playerId);
    res.status(200).json(await listPendingRequests(player.id));
  }),
);

friendsRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const player = await requireRegisteredPlayer(req.session.playerId);
    const { q } = friendSearchQuerySchema.parse(req.query);
    res.status(200).json(await searchPlayers(q, player.id));
  }),
);

friendsRouter.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const player = await requireRegisteredPlayer(req.session.playerId);
    const friendIds = await getFriendIds(player.id);
    res.status(200).json(await getFriendLeaderboard(player.id, friendIds));
  }),
);

friendsRouter.post(
  '/requests',
  asyncHandler(async (req, res) => {
    const player = await requireRegisteredPlayer(req.session.playerId);
    const { username } = sendFriendRequestSchema.parse(req.body);
    await sendFriendRequest(player.id, username);
    res.status(204).end();
  }),
);

friendsRouter.post(
  '/requests/:id/accept',
  asyncHandler(async (req, res) => {
    const player = await requireRegisteredPlayer(req.session.playerId);
    const requestId = friendRequestIdParamSchema.parse(req.params.id);
    await respondToFriendRequest(player.id, requestId, true);
    res.status(204).end();
  }),
);

friendsRouter.post(
  '/requests/:id/decline',
  asyncHandler(async (req, res) => {
    const player = await requireRegisteredPlayer(req.session.playerId);
    const requestId = friendRequestIdParamSchema.parse(req.params.id);
    await respondToFriendRequest(player.id, requestId, false);
    res.status(204).end();
  }),
);

friendsRouter.post(
  '/invite/:code',
  asyncHandler(async (req, res) => {
    const player = await requireRegisteredPlayer(req.session.playerId);
    const code = friendInviteCodeParamSchema.parse(req.params.code);
    await acceptInviteLink(player.id, code);
    res.status(204).end();
  }),
);
