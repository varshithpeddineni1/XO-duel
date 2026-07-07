interface BackButtonProps {
  onClick: () => void;
}

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '9px',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 700,
      }}
    >
      ‹
    </button>
  );
}
