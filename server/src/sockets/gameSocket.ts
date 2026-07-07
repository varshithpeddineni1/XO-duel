// Real-time online-game event handlers (API-8: pushed as they happen, never polled).
// Server-authoritative (ARC-5): a socket is bound to exactly one mark at join time, and
// every move is validated the same way as the REST path (gameService.submitMove).
import type { Request } from 'express';
import type { Server, Socket } from 'socket.io';
import { env } from '../config/env.js';
import type { Mark } from '../domain/gameLogic.js';
import { toErrorResponse } from '../lib/errorResponse.js';
import { GameNotFoundError, GameNotJoinableError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { joinGameSchema, socketMoveSchema } from '../schemas/gameSchemas.js';
import {
  abandonWaitingGame,
  createRematchGame,
  findGameByInviteCode,
  forfeitGame,
  getGame,
  joinOnlineGame,
  submitMove,
  type GameState,
} from '../services/gameService.js';
import {
  createRoom,
  deleteRoom,
  findRoomBySocketId,
  getRoom,
  otherMark,
  roomName,
  type RoomState,
} from './roomState.js';

type AckError = { code: string; message: string };
type JoinAck = (
  res:
    | { ok: true; role: Mark; reconnectToken: string; game: GameState }
    | { ok: false; error: AckError },
) => void;
type MoveAck = (res: { ok: true; game: GameState } | { ok: false; error: AckError }) => void;

function toAckError(err: unknown): AckError {
  const { code, message } = toErrorResponse(err);
  return { code, message };
}

function otherSocketId(room: RoomState, mark: Mark): string | undefined {
  return room.sockets[otherMark(mark)];
}

// The session middleware is shared with Express (see index.ts's createServer) via
// io.engine.use(), so socket.request carries whichever session cookie this connection's
// browser sent — the same identity REST calls from that same tab would see. socket.request
// is typed as plain http.IncomingMessage; @types/express-session only augments
// Express.Request (not IncomingMessage directly), hence the cast — the property really is
// there at runtime once io.engine.use(sessionMiddleware) has run.
function socketPlayerId(socket: Socket): number | null {
  return (socket.request as Request).session?.playerId ?? null;
}

function tryReconnect(socket: Socket, room: RoomState, reconnectToken: string): Mark | null {
  const mark = (['X', 'O'] as const).find((m) => room.tokens[m] === reconnectToken);
  if (!mark) return null;

  if (room.disconnectTimer && room.disconnectedMark === mark) {
    clearTimeout(room.disconnectTimer);
    room.disconnectTimer = null;
    room.disconnectedMark = null;
  }
  room.sockets[mark] = socket.id;
  void socket.join(roomName(room.gameId));
  return mark;
}

async function handleJoinGame(io: Server, socket: Socket, payload: unknown, ack: JoinAck) {
  try {
    const { inviteCode, reconnectToken } = joinGameSchema.parse(payload);
    const game = await findGameByInviteCode(inviteCode);
    const existingRoom = getRoom(game.id);

    // TEMPORARY — diagnosing a cross-device reconnect failure (creator's own tab getting
    // rejected as "not joinable" after backgrounding). Logs match results, never the actual
    // token values, so this is safe to leave in briefly but should be removed once resolved.
    logger.info('join_game received', {
      gameId: game.id,
      inviteCode,
      status: game.status,
      hasReconnectToken: Boolean(reconnectToken),
      hasExistingRoom: Boolean(existingRoom),
      matchesX: existingRoom ? existingRoom.tokens.X === reconnectToken : null,
      matchesO: existingRoom ? existingRoom.tokens.O === reconnectToken : null,
      roomHasSocketX: existingRoom ? Boolean(existingRoom.sockets.X) : null,
      roomHasSocketO: existingRoom ? Boolean(existingRoom.sockets.O) : null,
      disconnectedMark: existingRoom?.disconnectedMark ?? null,
      hasDisconnectTimer: existingRoom ? Boolean(existingRoom.disconnectTimer) : null,
    });

    if (reconnectToken && existingRoom) {
      const mark = tryReconnect(socket, existingRoom, reconnectToken);
      if (mark) {
        const fresh = await getGame(game.id);
        const other = otherSocketId(existingRoom, mark);
        if (other) io.to(other).emit('player_reconnected', { mark });
        ack({ ok: true, role: mark, reconnectToken, game: fresh });
        return;
      }
    }

    if (game.status !== 'waiting') {
      throw new GameNotJoinableError(inviteCode);
    }

    if (!existingRoom) {
      const room = createRoom(game.id);
      room.sockets.X = socket.id;
      await socket.join(roomName(game.id));
      ack({ ok: true, role: 'X', reconnectToken: room.tokens.X, game });
      return;
    }

    const joined = await joinOnlineGame(inviteCode, socketPlayerId(socket));
    existingRoom.sockets.O = socket.id;
    await socket.join(roomName(game.id));
    io.to(roomName(game.id)).emit('player_joined', { game: joined });
    ack({ ok: true, role: 'O', reconnectToken: existingRoom.tokens.O, game: joined });
  } catch (err) {
    ack({ ok: false, error: toAckError(err) });
  }
}

async function handleMakeMove(io: Server, socket: Socket, payload: unknown, ack: MoveAck) {
  try {
    const found = findRoomBySocketId(socket.id);
    if (!found) throw new GameNotFoundError('(no active game for this connection)');
    const { room, mark } = found;
    const { cell } = socketMoveSchema.parse(payload);

    const state = await submitMove(room.gameId, cell, mark);
    io.to(roomName(room.gameId)).emit('move_made', { game: state });
    if (state.status === 'complete') {
      io.to(roomName(room.gameId)).emit('game_over', { game: state, reason: 'completed' });
    }
    ack({ ok: true, game: state });
  } catch (err) {
    ack({ ok: false, error: toAckError(err) });
  }
}

function handleRequestRematch(io: Server, socket: Socket) {
  const found = findRoomBySocketId(socket.id);
  if (!found) return;
  const { room, mark } = found;
  room.rematchRequestedBy = mark;
  const other = otherSocketId(room, mark);
  if (other) io.to(other).emit('rematch_requested', { by: mark });
}

function handleDeclineRematch(io: Server, socket: Socket) {
  const found = findRoomBySocketId(socket.id);
  if (!found) return;
  const { room, mark } = found;
  room.rematchRequestedBy = null;
  const other = otherSocketId(room, mark);
  if (other) io.to(other).emit('rematch_declined', { by: mark });
}

async function handleAcceptRematch(io: Server, socket: Socket) {
  const found = findRoomBySocketId(socket.id);
  if (!found || !found.room.rematchRequestedBy) return;
  const { room } = found;

  try {
    const xSocket = room.sockets.X ? io.sockets.sockets.get(room.sockets.X) : undefined;
    const oSocket = room.sockets.O ? io.sockets.sockets.get(room.sockets.O) : undefined;
    const newGame = await createRematchGame(
      xSocket ? socketPlayerId(xSocket) : null,
      oSocket ? socketPlayerId(oSocket) : null,
    );
    const oldRoomName = roomName(room.gameId);
    const newRoomName = roomName(newGame.id);
    const newRoom = createRoom(newGame.id);

    for (const mark of ['X', 'O'] as const) {
      const sid = room.sockets[mark];
      if (!sid) continue;
      newRoom.sockets[mark] = sid;
      const targetSocket = io.sockets.sockets.get(sid);
      if (targetSocket) {
        await targetSocket.leave(oldRoomName);
        await targetSocket.join(newRoomName);
      }
      io.to(sid).emit('reconnect_token', { gameId: newGame.id, token: newRoom.tokens[mark] });
    }

    deleteRoom(room.gameId);
    io.to(newRoomName).emit('rematch_accepted', { game: newGame });
  } catch (err) {
    logger.error('rematch failed', {
      gameId: room.gameId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function runForfeit(io: Server, gameId: number, winningMark: Mark, notifySocketId: string) {
  try {
    const finalState = await forfeitGame(gameId, winningMark);
    io.to(notifySocketId).emit('game_over', { game: finalState, reason: 'forfeit' });
  } catch (err) {
    logger.error('forfeit failed', {
      gameId,
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    deleteRoom(gameId);
  }
}

async function handleDisconnect(io: Server, socket: Socket) {
  const found = findRoomBySocketId(socket.id);
  if (!found) return;
  const { room, mark } = found;
  const winningMark = otherMark(mark);
  const otherSid = room.sockets[winningMark];

  if (!otherSid) {
    // A much longer, separate grace period than a mid-game disconnect — there's no live
    // opponent to notify here, and the whole point of a shareable invite link/QR code is
    // surviving the creator's tab closing while they actually go send it (mobile browsers
    // commonly suspend a backgrounded tab's WebSocket the moment they switch apps to do
    // that). tryReconnect already clears this timer if the creator comes back with their
    // reconnectToken before it fires.
    room.disconnectedMark = mark;
    room.disconnectTimer = setTimeout(() => {
      // Re-check at fire time: a genuine second player may have joined during the grace
      // period, in which case the room is live now and must not be torn down.
      if (room.sockets[winningMark]) return;
      void abandonWaitingGame(room.gameId).then(() => deleteRoom(room.gameId));
    }, env.waitingGameGracePeriodMs);
    return;
  }

  room.disconnectedMark = mark;
  io.to(otherSid).emit('player_disconnected', { mark });
  room.disconnectTimer = setTimeout(() => {
    void runForfeit(io, room.gameId, winningMark, otherSid);
  }, env.disconnectGracePeriodMs);
}

export function registerGameSockets(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on('join_game', (payload: unknown, ack: JoinAck) => {
      void handleJoinGame(io, socket, payload, ack);
    });
    socket.on('make_move', (payload: unknown, ack: MoveAck) => {
      void handleMakeMove(io, socket, payload, ack);
    });
    socket.on('request_rematch', () => handleRequestRematch(io, socket));
    socket.on('accept_rematch', () => void handleAcceptRematch(io, socket));
    socket.on('decline_rematch', () => handleDeclineRematch(io, socket));
    socket.on('disconnect', () => void handleDisconnect(io, socket));
  });
}
