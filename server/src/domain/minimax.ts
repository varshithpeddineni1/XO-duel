// Minimax AI opponent — pure, no I/O (ARC-1). Ported from the Claude Design prototype's
// minimax()/getAiMove(), with alpha-beta pruning added per spec §5. The AI always plays 'O';
// the human always plays 'X' and moves first (spec §4.2, §11).
import { type Board, type Mark, checkWinner } from './gameLogic.js';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';

export interface MinimaxResult {
  index: number | null;
  score: number;
}

const opponentOf = (player: Mark): Mark => (player === 'X' ? 'O' : 'X');

export function minimax(
  board: Board,
  player: Mark,
  alpha = -Infinity,
  beta = Infinity,
): MinimaxResult {
  const { winner } = checkWinner(board);
  if (winner === 'X') return { index: null, score: -1 };
  if (winner === 'O') return { index: null, score: 1 };
  if (winner === 'draw') return { index: null, score: 0 };

  const maximizing = player === 'O';
  let best: MinimaxResult = { index: null, score: maximizing ? -Infinity : Infinity };
  let a = alpha;
  let b = beta;

  for (let i = 0; i < board.length; i++) {
    if (board[i] !== null) continue;

    const next = board.slice();
    next[i] = player;
    const result = minimax(next, opponentOf(player), a, b);

    if (maximizing) {
      if (result.score > best.score) best = { index: i, score: result.score };
      a = Math.max(a, best.score);
    } else {
      if (result.score < best.score) best = { index: i, score: result.score };
      b = Math.min(b, best.score);
    }
    if (b <= a) break;
  }

  return best;
}

function findWinningMove(board: Board, player: Mark): number | null {
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== null) continue;
    const next = board.slice();
    next[i] = player;
    if (checkWinner(next).winner === player) return i;
  }
  return null;
}

function pickRandom(items: number[]): number {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) {
    throw new Error('pickRandom called with an empty array');
  }
  return item;
}

function randomEmptyCell(board: Board): number {
  const empty = board
    .map((cell, i) => (cell === null ? i : null))
    .filter((i): i is number => i !== null);
  return pickRandom(empty);
}

export function getAiMove(board: Board, difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return randomEmptyCell(board);

    case 'medium': {
      const win = findWinningMove(board, 'O');
      if (win !== null) return win;
      const block = findWinningMove(board, 'X');
      if (block !== null) return block;
      return randomEmptyCell(board);
    }

    case 'hard': {
      if (Math.random() < 0.15) return randomEmptyCell(board);
      const win = findWinningMove(board, 'O');
      if (win !== null) return win;
      const block = findWinningMove(board, 'X');
      if (block !== null) return block;
      if (board[4] === null) return 4;
      const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
      if (corners.length > 0) {
        return pickRandom(corners);
      }
      // Unreachable on any non-terminal board: if no win/block move exists and every
      // corner + the center are already taken, the geometry of tic-tac-toe forces a
      // completed line among them, which means checkWinner would already have ended the
      // game before getAiMove was ever called. Kept as a defensive fallback anyway,
      // matching the ported mockup logic.
      /* c8 ignore next */
      return randomEmptyCell(board);
    }

    case 'impossible': {
      const result = minimax(board, 'O');
      if (result.index === null) {
        throw new Error('minimax could not find a move on a non-terminal board');
      }
      return result.index;
    }
  }
}
