interface RematchButtonProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}

export function RematchButton({
  onClick,
  label = 'Rematch',
  disabled = false,
}: RematchButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? 'var(--surface-raised)' : 'var(--accent)',
        color: disabled ? 'var(--fg-muted)' : 'var(--accent-fg)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        padding: '17px',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: '17px',
        cursor: disabled ? 'default' : 'pointer',
        width: '100%',
      }}
    >
      {label}
    </button>
  );
}
