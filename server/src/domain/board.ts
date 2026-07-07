// Reconstructs board state by replaying the ordered move log — the `moves` table is the
// single source of truth (DB-6); no `board` column exists on `games`. Pure, no I/O.
import { emptyBoard, type Board, type Mark } from './gameLogic.js';

export interface MoveRecord {
  cell: number;
  mark: Mark;
}

export function boardFromMoves(moves: MoveRecord[]): Board {
  const board = emptyBoard();
  for (const move of moves) {
    board[move.cell] = move.mark;
  }
  return board;
}
