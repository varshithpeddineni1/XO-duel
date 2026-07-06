// Win/draw detection — pure, no I/O, unit-tested without a server or database (ARC-1).
// Ported from the Claude Design prototype (.specify/XO Duel.html), whose checkWinner()
// logic was already correct.
export type Mark = 'X' | 'O';
export type Cell = Mark | null;

// Always exactly 9 entries by construction (emptyBoard / every mutation preserves length).
export type Board = Cell[];

export type WinLine = readonly [number, number, number];

export const WIN_LINES: readonly WinLine[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export type GameResult =
  { winner: Mark; line: WinLine } | { winner: 'draw'; line: null } | { winner: null; line: null };

export function emptyBoard(): Board {
  return new Array(9).fill(null);
}

export function checkWinner(board: Board): GameResult {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return { winner: mark, line };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: 'draw', line: null };
  }
  return { winner: null, line: null };
}
