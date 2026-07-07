import { describe, expect, it } from 'vitest';
import { boardFromMoves } from './board.js';
import { emptyBoard } from './gameLogic.js';

describe('boardFromMoves', () => {
  it('returns an empty board for an empty move list', () => {
    expect(boardFromMoves([])).toEqual(emptyBoard());
  });

  it('places each move at its cell, in any order', () => {
    const board = boardFromMoves([
      { cell: 0, mark: 'X' },
      { cell: 4, mark: 'O' },
      { cell: 8, mark: 'X' },
    ]);
    expect(board).toEqual(['X', null, null, null, 'O', null, null, null, 'X']);
  });
});
