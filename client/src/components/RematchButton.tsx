interface RematchButtonProps {
  onClick: () => void;
  label?: string;
}

export function RematchButton({ onClick, label = 'Rematch' }: RematchButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'var(--accent)',
        color: 'var(--accent-fg)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        padding: '17px',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: '17px',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      {label}
    </button>
  );
}
