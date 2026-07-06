import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkWinner, emptyBoard, type Board, type Mark } from './gameLogic.js';
import { getAiMove, minimax } from './minimax.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAiMove — easy', () => {
  it('always returns an empty cell', () => {
    const board: Board = ['X', null, 'O', null, null, null, null, null, null];
    for (let i = 0; i < 20; i++) {
      const move = getAiMove(board, 'easy');
      expect(board[move]).toBeNull();
    }
  });
});

describe('getAiMove — medium', () => {
  it('takes an immediate winning move over anything else', () => {
    const board: Board = ['O', 'O', null, 'X', 'X', null, null, null, null];
    expect(getAiMove(board, 'medium')).toBe(2);
  });

  it('blocks an immediate opponent win when it cannot win itself', () => {
    const board: Board = ['X', 'X', null, 'O', null, null, null, null, null];
    expect(getAiMove(board, 'medium')).toBe(2);
  });
});

describe('getAiMove — hard', () => {
  it('takes an immediate winning move (random-mistake branch disabled)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const board: Board = ['O', 'O', null, 'X', 'X', null, null, null, null];
    expect(getAiMove(board, 'hard')).toBe(2);
  });

  it('blocks an immediate opponent win (random-mistake branch disabled)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const board: Board = ['X', 'X', null, 'O', null, null, null, null, null];
    expect(getAiMove(board, 'hard')).toBe(2);
  });

  it('makes a genuine mistake when the random-mistake branch triggers', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05);
    // Without the mistake branch, hard would pick the open center (4); forcing the
    // mistake branch instead returns randomEmptyCell's first pick, demonstrating it
    // bypasses the smart logic entirely.
    const board: Board = ['X', null, null, null, null, null, null, null, null];
    expect(getAiMove(board, 'hard')).toBe(1);
  });

  it('plays the center when no win/block is available and the center is open', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const board: Board = ['X', null, null, null, null, null, null, null, null];
    expect(getAiMove(board, 'hard')).toBe(4);
  });

  it('plays a corner when the center is taken and no win/block is available', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const board: Board = [null, null, null, null, 'X', null, null, null, null];
    expect(getAiMove(board, 'hard')).toBe(6);
  });
});

describe('getAiMove — impossible (minimax)', () => {
  it('never loses from any reachable board state (TEST-3)', () => {
    // X (the human) tries every legal move at every one of its turns, including
    // deliberately bad ones; O (the AI) always plays the impossible tier. Assert that
    // no path through this exhaustive tree ever ends with X winning.
    function playOut(board: Board, toMove: Mark): void {
      const { winner } = checkWinner(board);
      if (winner !== null) {
        expect(winner).not.toBe('X');
        return;
      }

      if (toMove === 'O') {
        const move = getAiMove(board, 'impossible');
        const next = board.slice();
        next[move] = 'O';
        playOut(next, 'X');
        return;
      }

      for (let i = 0; i < board.length; i++) {
        if (board[i] !== null) continue;
        const next = board.slice();
        next[i] = 'X';
        playOut(next, 'O');
      }
    }

    playOut(emptyBoard(), 'X');
  });
});

describe('minimax', () => {
  it('scores an already-won board as -1 (X win) regardless of whose turn it would be', () => {
    const board: Board = ['X', 'X', 'X', null, 'O', 'O', null, null, null];
    expect(minimax(board, 'O').score).toBe(-1);
  });

  it('scores an already-drawn board as 0', () => {
    const board: Board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    expect(minimax(board, 'O').score).toBe(0);
  });

  it('picks the center on an empty board when playing O', () => {
    // Textbook-optimal opening reply for the second player once X has taken a corner.
    const board: Board = ['X', null, null, null, null, null, null, null, null];
    expect(minimax(board, 'O').index).toBe(4);
  });
});
