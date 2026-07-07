import type { Mark } from '../api/games.js';

interface CellProps {
  index: number;
  value: Mark | null;
  highlighted: boolean;
  disabled: boolean;
  onClick: () => void;
}

// X and O are drawn with plain divs (rotated bars / a bordered circle), matching the
// mockup — no icon font or SVG asset needed.
export function Cell({ index, value, highlighted, disabled, onClick }: CellProps) {
  const label = value ? `Cell ${index + 1}, ${value}` : `Cell ${index + 1}, empty`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled || value !== null}
      style={{
        background: highlighted ? 'var(--accent-soft)' : 'var(--surface)',
        border: 'none',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        aspectRatio: '1',
        width: '100%',
        fontSize: '44px',
        cursor: value === null && !disabled ? 'pointer' : 'default',
        padding: 0,
      }}
    >
      {value === 'X' && (
        <div style={{ position: 'relative', width: '1em', height: '1em' }}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '100%',
              height: '0.14em',
              background: 'var(--x-color)',
              borderRadius: '999px',
              transform: 'translate(-50%, -50%) rotate(45deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '100%',
              height: '0.14em',
              background: 'var(--x-color)',
              borderRadius: '999px',
              transform: 'translate(-50%, -50%) rotate(-45deg)',
            }}
          />
        </div>
      )}
      {value === 'O' && (
        <div
          style={{
            width: '0.6em',
            height: '0.6em',
            borderRadius: '50%',
            border: '0.13em solid var(--o-color)',
          }}
        />
      )}
    </button>
  );
}
