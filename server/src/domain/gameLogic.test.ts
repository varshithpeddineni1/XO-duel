import { describe, expect, it } from 'vitest';
import { checkWinner, emptyBoard, type Board } from './gameLogic.js';

describe('checkWinner', () => {
  it('detects a horizontal win', () => {
    const board: Board = ['X', 'X', 'X', null, 'O', 'O', null, null, null];
    expect(checkWinner(board)).toEqual({ winner: 'X', line: [0, 1, 2] });
  });

  it('detects a vertical win', () => {
    const board: Board = ['O', 'X', null, 'O', 'X', null, 'O', null, 'X'];
    expect(checkWinner(board)).toEqual({ winner: 'O', line: [0, 3, 6] });
  });

  it('detects a diagonal win', () => {
    const board: Board = ['X', 'O', 'O', null, 'X', null, null, null, 'X'];
    expect(checkWinner(board)).toEqual({ winner: 'X', line: [0, 4, 8] });
  });

  it('detects the anti-diagonal win', () => {
    const board: Board = [null, null, 'O', null, 'O', null, 'O', null, null];
    expect(checkWinner(board)).toEqual({ winner: 'O', line: [2, 4, 6] });
  });

  it('detects a full-board draw', () => {
    const board: Board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    expect(checkWinner(board)).toEqual({ winner: 'draw', line: null });
  });

  it('reports no result for an in-progress board', () => {
    const board: Board = ['X', null, null, null, 'O', null, null, null, null];
    expect(checkWinner(board)).toEqual({ winner: null, line: null });
  });

  it('reports no result for an empty board', () => {
    expect(checkWinner(emptyBoard())).toEqual({ winner: null, line: null });
  });
});
