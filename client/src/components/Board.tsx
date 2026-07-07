import type { Cell as CellValue } from '../api/games.js';
import { Cell } from './Cell.js';

interface BoardProps {
  board: CellValue[];
  winLine: readonly [number, number, number] | null;
  disabled: boolean;
  onCellClick: (cell: number) => void;
}

export function Board({ board, winLine, disabled, onCellClick }: BoardProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
        width: '100%',
        maxWidth: '300px',
        background: 'var(--border)',
        padding: '10px',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {board.map((value, index) => (
        <Cell
          key={index}
          index={index}
          value={value}
          highlighted={winLine?.includes(index) ?? false}
          disabled={disabled}
          onClick={() => onCellClick(index)}
        />
      ))}
    </div>
  );
}
