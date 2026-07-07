// Game creation, move validation, and completion — the server is the sole authority on
// game state (ARC-5). Business logic lives here, not in routes (ARC-2). Reuses Phase 1's
// pure domain functions directly; never trusts a client-submitted AI move.
import type { Pool, PoolClient } from 'pg';
import { getPool } from '../db/pool.js';
import { boardFromMoves, type MoveRecord } from '../domain/board.js';
import { checkWinner, type Board, type Mark, type WinLine } from '../domain/gameLogic.js';
import { getAiMove } from '../domain/minimax.js';
import { GameNotFoundError, GameNotInProgressError, IllegalMoveError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { CreateGameInput, DifficultyInput } from '../schemas/gameSchemas.js';

export type GameMode = 'local' | 'ai';
export type GameStatus = 'in_progress' | 'complete';

export interface GameState {
  id: number;
  mode: GameMode;
  aiDifficulty: DifficultyInput | null;
  board: Board;
  currentPlayer: Mark;
  status: GameStatus;
  winner: Mark | 'draw' | null;
  winLine: WinLine | null;
}

interface GameRow {
  id: number;
  mode: GameMode;
  ai_difficulty: DifficultyInput | null;
  status: GameStatus;
}

type Queryable = Pool | PoolClient;

async function loadGameRow(db: Queryable, gameId: number): Promise<GameRow> {
  const { rows } = await db.query<GameRow>(
    'SELECT id, mode, ai_difficulty, status FROM games WHERE id = $1',
    [gameId],
  );
  const row = rows[0];
  if (!row) throw new GameNotFoundError(String(gameId));
  return row;
}

async function loadMoves(db: Queryable, gameId: number): Promise<MoveRecord[]> {
  const { rows } = await db.query<MoveRecord>(
    'SELECT cell, mark FROM moves WHERE game_id = $1 ORDER BY move_number ASC',
    [gameId],
  );
  return rows;
}

function toGameState(row: GameRow, moves: MoveRecord[]): GameState {
  const board = boardFromMoves(moves);
  const { winner, line } = checkWinner(board);
  const currentPlayer: Mark = moves.length % 2 === 0 ? 'X' : 'O';
  return {
    id: row.id,
    mode: row.mode,
    aiDifficulty: row.ai_difficulty,
    board,
    currentPlayer,
    status: row.status,
    winner,
    winLine: line,
  };
}

async function applyMove(
  client: PoolClient,
  gameId: number,
  existingMoves: MoveRecord[],
  cell: number,
  mark: Mark,
): Promise<MoveRecord[]> {
  const moveNumber = existingMoves.length;
  await client.query(
    'INSERT INTO moves (game_id, cell, mark, move_number) VALUES ($1, $2, $3, $4)',
    [gameId, cell, mark, moveNumber],
  );
  return [...existingMoves, { cell, mark }];
}

async function finalizeIfOver(
  client: PoolClient,
  game: GameRow,
  moves: MoveRecord[],
): Promise<GameState> {
  const state = toGameState(game, moves);
  if (state.winner === null) {
    return state;
  }

  const xOutcome = state.winner === 'draw' ? 'draw' : state.winner === 'X' ? 'win' : 'loss';
  const oOutcome = state.winner === 'draw' ? 'draw' : state.winner === 'O' ? 'win' : 'loss';

  await client.query("UPDATE games SET status = 'complete', completed_at = now() WHERE id = $1", [
    game.id,
  ]);
  await client.query(
    `UPDATE game_players SET outcome = CASE mark WHEN 'X' THEN $2 WHEN 'O' THEN $3 END
     WHERE game_id = $1`,
    [game.id, xOutcome, oOutcome],
  );
  await client.query('INSERT INTO events (game_id, type, payload) VALUES ($1, $2, $3)', [
    game.id,
    'game_completed',
    JSON.stringify({ winner: state.winner, mode: game.mode }),
  ]);

  return { ...state, status: 'complete' };
}

export async function createGame(input: CreateGameInput): Promise<GameState> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const aiDifficulty = input.mode === 'ai' ? input.aiDifficulty : null;
    const { rows } = await client.query<GameRow>(
      `INSERT INTO games (mode, ai_difficulty, status) VALUES ($1, $2, 'in_progress')
       RETURNING id, mode, ai_difficulty, status`,
      [input.mode, aiDifficulty],
    );
    const game = rows[0];
    if (!game) throw new Error('game insert returned no row');
    await client.query("INSERT INTO game_players (game_id, mark) VALUES ($1, 'X'), ($1, 'O')", [
      game.id,
    ]);
    await client.query('COMMIT');
    logger.info('game created', { gameId: game.id, mode: game.mode });
    return toGameState(game, []);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getGame(gameId: number): Promise<GameState> {
  const pool = getPool();
  const game = await loadGameRow(pool, gameId);
  const moves = await loadMoves(pool, gameId);
  return toGameState(game, moves);
}

export async function submitMove(gameId: number, cell: number, mark: Mark): Promise<GameState> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const game = await loadGameRow(client, gameId);
    if (game.status !== 'in_progress') {
      throw new GameNotInProgressError(String(gameId));
    }

    let moves = await loadMoves(client, gameId);
    const board = boardFromMoves(moves);
    const currentPlayer: Mark = moves.length % 2 === 0 ? 'X' : 'O';

    if (game.mode === 'ai' && mark === 'O') {
      throw new IllegalMoveError("The AI's move can't be submitted by a client.");
    }
    if (mark !== currentPlayer) {
      throw new IllegalMoveError(`It is ${currentPlayer}'s turn, not ${mark}'s.`);
    }
    if (board[cell] !== null) {
      throw new IllegalMoveError(`Cell ${cell} is already taken.`);
    }

    moves = await applyMove(client, gameId, moves, cell, mark);
    let state = await finalizeIfOver(client, game, moves);

    if (state.status === 'in_progress' && game.mode === 'ai' && game.ai_difficulty) {
      const aiCell = getAiMove(state.board, game.ai_difficulty);
      moves = await applyMove(client, gameId, moves, aiCell, 'O');
      state = await finalizeIfOver(client, game, moves);
    }

    await client.query('COMMIT');
    logger.info('move applied', { gameId, cell, mark, status: state.status });
    return state;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
