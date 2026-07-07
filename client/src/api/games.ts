// Thin fetch wrappers against the server's REST surface. Types are hand-duplicated from
// server/src/services/gameService.ts's GameState — no shared-types package exists yet
// (that's more than this phase needs).
export type Mark = 'X' | 'O';
export type Cell = Mark | null;
export type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';
export type GameMode = 'local' | 'ai';

export interface GameState {
  id: number;
  mode: GameMode;
  aiDifficulty: Difficulty | null;
  board: Cell[];
  currentPlayer: Mark;
  status: 'in_progress' | 'complete';
  winner: Mark | 'draw' | null;
  winLine: readonly [number, number, number] | null;
}

export type CreateGameInput = { mode: 'local' } | { mode: 'ai'; aiDifficulty: Difficulty };

export class GamesApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'GamesApiError';
    this.code = code;
  }
}

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

async function parseGameResponse(res: Response): Promise<GameState> {
  const body: unknown = await res.json();
  if (!res.ok) {
    const errorBody = body as { error?: { code?: string; message?: string } };
    throw new GamesApiError(
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? 'Something went wrong.',
    );
  }
  return body as GameState;
}

export async function createGame(input: CreateGameInput): Promise<GameState> {
  const res = await fetch(`${API_URL}/api/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseGameResponse(res);
}

export async function getGame(id: number): Promise<GameState> {
  const res = await fetch(`${API_URL}/api/games/${id}`);
  return parseGameResponse(res);
}

export async function submitMove(id: number, cell: number, mark: Mark): Promise<GameState> {
  const res = await fetch(`${API_URL}/api/games/${id}/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cell, mark }),
  });
  return parseGameResponse(res);
}
