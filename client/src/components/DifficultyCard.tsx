interface DifficultyCardProps {
  title: string;
  subtitle: string;
  level: number;
  maxLevel: number;
  selected: boolean;
  onClick: () => void;
}

export function DifficultyCard({
  title,
  subtitle,
  level,
  maxLevel,
  selected,
  onClick,
}: DifficultyCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>
          {title}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--fg-muted)', marginTop: '2px' }}>
          {subtitle}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {Array.from({ length: maxLevel }, (_, i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: i < level ? 'var(--accent)' : 'var(--border)',
            }}
          />
        ))}
      </div>
    </button>
  );
}
