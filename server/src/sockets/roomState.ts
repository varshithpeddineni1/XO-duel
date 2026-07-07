// In-memory online-game room state: which socket is bound to which mark, each mark's
// reconnect token, and the active disconnect grace-period timer. Deliberately not
// persisted (see docs/adr/0002-online-room-state.md) — acceptable for a single-instance
// deployment; a mid-game server restart loses reconnect capability for games in flight.
import { randomUUID } from 'node:crypto';
import type { Mark } from '../domain/gameLogic.js';

export interface RoomState {
  gameId: number;
  sockets: Partial<Record<Mark, string>>;
  tokens: Record<Mark, string>;
  disconnectTimer: NodeJS.Timeout | null;
  disconnectedMark: Mark | null;
  rematchRequestedBy: Mark | null;
}

const rooms = new Map<number, RoomState>();

export function roomName(gameId: number): string {
  return `game:${gameId}`;
}

export function createRoom(gameId: number): RoomState {
  const state: RoomState = {
    gameId,
    sockets: {},
    tokens: { X: randomUUID(), O: randomUUID() },
    disconnectTimer: null,
    disconnectedMark: null,
    rematchRequestedBy: null,
  };
  rooms.set(gameId, state);
  return state;
}

export function getRoom(gameId: number): RoomState | undefined {
  return rooms.get(gameId);
}

export function deleteRoom(gameId: number): void {
  const room = rooms.get(gameId);
  if (room?.disconnectTimer) clearTimeout(room.disconnectTimer);
  rooms.delete(gameId);
}

export function findRoomBySocketId(socketId: string): { room: RoomState; mark: Mark } | undefined {
  for (const room of rooms.values()) {
    for (const mark of ['X', 'O'] as const) {
      if (room.sockets[mark] === socketId) return { room, mark };
    }
  }
  return undefined;
}

export function otherMark(mark: Mark): Mark {
  return mark === 'X' ? 'O' : 'X';
}
