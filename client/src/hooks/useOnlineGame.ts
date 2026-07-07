// Owns the Socket.io connection for one online game — connect, join, listen for every
// server event, expose actions. Transport for online mode only; local/AI still use the
// plain REST client in api/games.ts.
//
// Known limitation: reconnect-after-refresh is only guaranteed for the *original* game
// behind an invite code. After a mutual-accept rematch, the browser tab's live state
// moves on to a new game id, but the session persisted for page-refresh recovery still
// points at the original one — refreshing mid-rematch may not resume seamlessly. Solving
// that fully would need the invite URL itself to track the current game (real routing),
// which is more than this phase needs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { GameState, Mark } from '../api/games.js';

const SOCKET_URL =
  (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'http://localhost:3000';

export type OpponentStatus = 'connected' | 'disconnected';
export type RematchState = 'idle' | 'requested-by-me' | 'requested-by-opponent';

type AckError = { code: string; message: string };
type JoinResponse =
  | { ok: true; role: Mark; reconnectToken: string; game: GameState }
  | { ok: false; error: AckError };
type MoveResponse = { ok: true; game: GameState } | { ok: false; error: AckError };

interface StoredSession {
  gameId: number;
  reconnectToken: string;
}

function storageKey(inviteCode: string): string {
  return `xo-duel-reconnect-${inviteCode}`;
}

function loadStoredSession(inviteCode: string): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(storageKey(inviteCode));
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function saveStoredSession(inviteCode: string, session: StoredSession): void {
  try {
    sessionStorage.setItem(storageKey(inviteCode), JSON.stringify(session));
  } catch {
    // sessionStorage unavailable (private browsing etc.) — reconnect-after-refresh just
    // won't work; the live game itself is unaffected.
  }
}

export interface UseOnlineGameResult {
  game: GameState | null;
  role: Mark | null;
  opponentStatus: OpponentStatus;
  rematchState: RematchState;
  error: string | null;
  submitMove: (cell: number) => void;
  requestRematch: () => void;
  acceptRematch: () => void;
  declineRematch: () => void;
}

export function useOnlineGame(inviteCode: string): UseOnlineGameResult {
  const [game, setGame] = useState<GameState | null>(null);
  const [role, setRole] = useState<Mark | null>(null);
  const [opponentStatus, setOpponentStatus] = useState<OpponentStatus>('connected');
  const [rematchState, setRematchState] = useState<RematchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!inviteCode) return undefined;

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    const stored = loadStoredSession(inviteCode);

    socket.on('connect', () => {
      socket.emit(
        'join_game',
        { inviteCode, reconnectToken: stored?.reconnectToken },
        (response: JoinResponse) => {
          if (!response.ok) {
            setError(response.error.message);
            return;
          }
          setRole(response.role);
          setGame(response.game);
          setOpponentStatus('connected');
          saveStoredSession(inviteCode, {
            gameId: response.game.id,
            reconnectToken: response.reconnectToken,
          });
        },
      );
    });

    socket.on('player_joined', (payload: { game: GameState }) => setGame(payload.game));
    socket.on('move_made', (payload: { game: GameState }) => setGame(payload.game));
    socket.on('game_over', (payload: { game: GameState }) => setGame(payload.game));
    socket.on('player_disconnected', () => setOpponentStatus('disconnected'));
    socket.on('player_reconnected', () => setOpponentStatus('connected'));
    socket.on('rematch_requested', () => setRematchState('requested-by-opponent'));
    socket.on('rematch_declined', () => setRematchState('idle'));
    socket.on('rematch_accepted', (payload: { game: GameState }) => {
      setGame(payload.game);
      setRematchState('idle');
      setOpponentStatus('connected');
    });
    socket.on('reconnect_token', (payload: { gameId: number; token: string }) => {
      saveStoredSession(inviteCode, { gameId: payload.gameId, reconnectToken: payload.token });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [inviteCode]);

  const submitMove = useCallback((cell: number) => {
    socketRef.current?.emit('make_move', { cell }, (response: MoveResponse) => {
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setGame(response.game);
    });
  }, []);

  const requestRematch = useCallback(() => {
    socketRef.current?.emit('request_rematch');
    setRematchState('requested-by-me');
  }, []);

  const acceptRematch = useCallback(() => {
    socketRef.current?.emit('accept_rematch');
  }, []);

  const declineRematch = useCallback(() => {
    socketRef.current?.emit('decline_rematch');
    setRematchState('idle');
  }, []);

  return {
    game,
    role,
    opponentStatus,
    rematchState,
    error,
    submitMove,
    requestRematch,
    acceptRematch,
    declineRematch,
  };
}
