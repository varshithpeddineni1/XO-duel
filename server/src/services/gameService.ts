// Game creation, move validation, and completion — the server is the sole authority on
// game state (ARC-5). Business logic lives here, not in routes (ARC-2). Reuses Phase 1's
// pure domain functions directly; never trusts a client-submitted AI move.
import type { Pool, PoolClient } from 'pg';
import { getPool } from '../db/pool.js';
import { boardFromMoves, type MoveRecord } from '../domain/board.js';
import { checkWinner, type Board, type Mark, type WinLine } from '../domain/gameLogic.js';
import { generateInviteCode } from '../domain/inviteCode.js';
import { getAiMove } from '../domain/minimax.js';
import {
  GameNotFoundError,
  GameNotInProgressError,
  GameNotJoinableError,
  IllegalMoveError,
} from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { CreateGameInput, DifficultyInput } from '../schemas/gameSchemas.js';

export type GameMode = 'local' | 'ai' | 'online';
export type GameStatus = 'waiting' | 'in_progress' | 'complete' | 'abandoned';

export interface GameState {
  id: number;
  mode: GameMode;
  aiDifficulty: DifficultyInput | null;
  inviteCode: string | null;
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
  invite_code: string | null;
  status: GameStatus;
}

type Queryable = Pool | PoolClient;

const GAME_ROW_COLUMNS = 'id, mode, ai_difficulty, invite_code, status';

async function loadGameRow(db: Queryable, gameId: number): Promise<GameRow> {
  const { rows } = await db.query<GameRow>(`SELECT ${GAME_ROW_COLUMNS} FROM games WHERE id = $1`, [
    gameId,
  ]);
  const row = rows[0];
  if (!row) throw new GameNotFoundError(String(gameId));
  return row;
}

async function loadGameRowByInviteCode(db: Queryable, inviteCode: string): Promise<GameRow> {
  const { rows } = await db.query<GameRow>(
    `SELECT ${GAME_ROW_COLUMNS} FROM games WHERE invite_code = $1`,
    [inviteCode],
  );
  const row = rows[0];
  if (!row) throw new GameNotFoundError(inviteCode);
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
    inviteCode: row.invite_code,
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

type LocalOrAiInput = Extract<CreateGameInput, { mode: 'local' } | { mode: 'ai' }>;

// playerId is attributed to the X seat only: local mode's "player 2" has no account by
// design (spec), and AI mode's O seat is the AI, never a player row.
export async function createGame(
  input: LocalOrAiInput,
  playerId: number | null = null,
): Promise<GameState> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const aiDifficulty = input.mode === 'ai' ? input.aiDifficulty : null;
    const { rows } = await client.query<GameRow>(
      `INSERT INTO games (mode, ai_difficulty, status) VALUES ($1, $2, 'in_progress')
       RETURNING ${GAME_ROW_COLUMNS}`,
      [input.mode, aiDifficulty],
    );
    const game = rows[0];
    if (!game) throw new Error('game insert returned no row');
    await client.query(
      `INSERT INTO game_players (game_id, mark, player_id) VALUES ($1, 'X', $2), ($1, 'O', NULL)`,
      [game.id, playerId],
    );
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

// ---------------------------------------------------------------------------------------
// Online mode (Phase 3) — invite-link join flow. Move application and finalization above
// (submitMove/finalizeIfOver) are reused as-is; a socket is simply one player, so the
// server determines `mark` from which socket is bound to which player (server/src/sockets),
// rather than trusting a client-supplied mark the way local mode's single session does.
// ---------------------------------------------------------------------------------------

async function generateUniqueInviteCode(client: PoolClient): Promise<string> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateInviteCode();
    const { rows } = await client.query('SELECT 1 FROM games WHERE invite_code = $1', [code]);
    if (rows.length === 0) return code;
  }
  throw new Error(`failed to generate a unique invite code after ${maxAttempts} attempts`);
}

export async function createOnlineGame(): Promise<GameState> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const inviteCode = await generateUniqueInviteCode(client);
    const { rows } = await client.query<GameRow>(
      `INSERT INTO games (mode, status, invite_code) VALUES ('online', 'waiting', $1)
       RETURNING ${GAME_ROW_COLUMNS}`,
      [inviteCode],
    );
    const game = rows[0];
    if (!game) throw new Error('game insert returned no row');
    await client.query("INSERT INTO game_players (game_id, mark) VALUES ($1, 'X')", [game.id]);
    await client.query('COMMIT');
    logger.info('online game created', { gameId: game.id, inviteCode });
    return toGameState(game, []);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Both players already share a live socket connection (mutual-accept rematch) — skip the
// 'waiting' state entirely and seat both marks immediately.
export async function createRematchGame(): Promise<GameState> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const inviteCode = await generateUniqueInviteCode(client);
    const { rows } = await client.query<GameRow>(
      `INSERT INTO games (mode, status, invite_code) VALUES ('online', 'in_progress', $1)
       RETURNING ${GAME_ROW_COLUMNS}`,
      [inviteCode],
    );
    const game = rows[0];
    if (!game) throw new Error('game insert returned no row');
    await client.query("INSERT INTO game_players (game_id, mark) VALUES ($1, 'X'), ($1, 'O')", [
      game.id,
    ]);
    await client.query('COMMIT');
    logger.info('online rematch game created', { gameId: game.id });
    return toGameState(game, []);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function findGameByInviteCode(inviteCode: string): Promise<GameState> {
  const pool = getPool();
  const game = await loadGameRowByInviteCode(pool, inviteCode);
  const moves = await loadMoves(pool, game.id);
  return toGameState(game, moves);
}

// Second player joining via the invite link (API-5: single-use once two players are in).
export async function joinOnlineGame(inviteCode: string): Promise<GameState> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<GameRow>(
      `SELECT ${GAME_ROW_COLUMNS} FROM games WHERE invite_code = $1 FOR UPDATE`,
      [inviteCode],
    );
    const game = rows[0];
    if (!game) throw new GameNotFoundError(inviteCode);
    if (game.status !== 'waiting') {
      throw new GameNotJoinableError(inviteCode);
    }

    await client.query("INSERT INTO game_players (game_id, mark) VALUES ($1, 'O')", [game.id]);
    await client.query("UPDATE games SET status = 'in_progress' WHERE id = $1", [game.id]);
    await client.query('COMMIT');
    logger.info('online game joined', { gameId: game.id });
    return toGameState({ ...game, status: 'in_progress' }, []);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// A player's socket never reconnected within the grace period — the connected opponent
// wins by forfeit. Tolerant of a race where the game already finished by other means
// (e.g. the last move landed right as the disconnect timer fired).
export async function forfeitGame(gameId: number, winningMark: Mark): Promise<GameState> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const game = await loadGameRow(client, gameId);
    const moves = await loadMoves(client, gameId);

    if (game.status !== 'in_progress') {
      await client.query('COMMIT');
      return toGameState(game, moves);
    }

    const losingMark: Mark = winningMark === 'X' ? 'O' : 'X';
    await client.query("UPDATE games SET status = 'complete', completed_at = now() WHERE id = $1", [
      gameId,
    ]);
    await client.query(
      `UPDATE game_players SET outcome = CASE mark WHEN $2 THEN 'win' WHEN $3 THEN 'loss' END
       WHERE game_id = $1`,
      [gameId, winningMark, losingMark],
    );
    await client.query('INSERT INTO events (game_id, type, payload) VALUES ($1, $2, $3)', [
      gameId,
      'game_forfeited',
      JSON.stringify({ winner: winningMark }),
    ]);
    await client.query('COMMIT');

    logger.info('game forfeited', { gameId, winner: winningMark });
    return {
      ...toGameState(game, moves),
      status: 'complete',
      winner: winningMark,
      winLine: null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// The waiting creator's socket disconnected before anyone joined — nothing to forfeit to,
// just mark the game abandoned so a stale invite code isn't left dangling as 'waiting'.
export async function abandonWaitingGame(gameId: number): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      "UPDATE games SET status = 'abandoned' WHERE id = $1 AND status = 'waiting'",
      [gameId],
    );
    if (rowCount) {
      await client.query('INSERT INTO events (game_id, type, payload) VALUES ($1, $2, $3)', [
        gameId,
        'game_abandoned',
        '{}',
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
